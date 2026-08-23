/**
 * Hunt4Food ratings proxy — deploy at script.google.com
 *
 * 1. New project → paste this file → Save
 * 2. Project Settings → Script properties:
 *    - YELP_API_KEY (optional, recommended): https://www.yelp.com/developers
 *    - GOOGLE_PLACES_API_KEY (optional): server-side Google Places; client may also pass googleKey
 * 3. Deploy → New deployment → Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 4. Copy the /exec URL into GitHub environment secret VITE_RATINGS_PROXY_URL
 *
 * Healthy search: source=healthyDiscover | healthyReviews
 * After editing, redeploy (Manage deployments → Edit → New version).
 */

function doGet(e) {
  var p = e && e.parameter ? e.parameter : {};
  var source = String(p.source || '');
  var name = String(p.name || '');
  var city = String(p.city || '');
  var lat = parseFloat(p.lat);
  var lon = parseFloat(p.lon);
  var callback = p.callback;
  var wantDishes = p.dishes === '1' || p.dishes === 'true';
  var googleKey = String(p.googleKey || '');

  var result;
  try {
    if (source === 'yelp') {
      result = fetchYelp_(name, city, lat, lon, wantDishes);
    } else if (source === 'tripadvisor') {
      result = fetchTripAdvisor_(name, city);
    } else if (source === 'google') {
      result = fetchGoogle_(name, city, lat, lon, googleKey);
    } else if (source === 'healthyDiscover') {
      result = fetchHealthyDiscover_(city, lat, lon, p.radius);
    } else if (source === 'healthyReviews') {
      result = fetchHealthyReviews_(String(p.ids || ''), city, String(p.names || ''));
    } else {
      result = { error: 'Unknown source. Use yelp, tripadvisor, google, healthyDiscover, or healthyReviews.' };
    }
  } catch (err) {
    result = { error: String(err), rating: null, reviewCount: null, url: null };
  }

  var json = JSON.stringify(result);
  if (callback) {
    return ContentService.createTextOutput(callback + '(' + json + ')').setMimeType(
      ContentService.MimeType.JAVASCRIPT,
    );
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function fetchYelp_(name, city, lat, lon, wantDishes) {
  var props = PropertiesService.getScriptProperties();
  var apiKey = props.getProperty('YELP_API_KEY');
  var searchUrl =
    'https://www.yelp.com/search?find_desc=' +
    encodeURIComponent(name) +
    '&find_loc=' +
    encodeURIComponent(city);

  if (apiKey && !isNaN(lat) && !isNaN(lon)) {
    var apiUrl =
      'https://api.yelp.com/v3/businesses/search?term=' +
      encodeURIComponent(name) +
      '&latitude=' +
      lat +
      '&longitude=' +
      lon +
      '&limit=1&sort_by=best_match';
    var resp = UrlFetchApp.fetch(apiUrl, {
      headers: { Authorization: 'Bearer ' + apiKey },
      muteHttpExceptions: true,
    });
    if (resp.getResponseCode() === 200) {
      var data = JSON.parse(resp.getContentText());
      var biz = data.businesses && data.businesses[0];
      if (biz) {
        var out = {
          rating: biz.rating || null,
          reviewCount: biz.review_count || null,
          url: biz.url || searchUrl,
          price: biz.price || null,
        };
        if (wantDishes) {
          out.dishes = fetchYelpDishes_(biz.id, biz.url || searchUrl, apiKey);
        }
        return out;
      }
    }
  }

  // Scrape fallback (may fail if Yelp blocks datacenter IP)
  var html = UrlFetchApp.fetch(searchUrl, {
    muteHttpExceptions: true,
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Hunt4Food/1.0)' },
  }).getContentText();
  var ratingMatch = html.match(/"rating":\s*(\d+(?:\.\d+)?)/);
  var countMatch = html.match(/"reviewCount":\s*(\d+)/);
  var priceMatch = html.match(/"price":\s*"(\$+)"/);
  var bizMatch = html.match(/href="(\/biz\/[^"?]+)/);
  var out = {
    rating: ratingMatch ? Number(ratingMatch[1]) : null,
    reviewCount: countMatch ? Number(countMatch[1]) : null,
    url: bizMatch ? 'https://www.yelp.com' + bizMatch[1] : searchUrl,
    price: priceMatch ? priceMatch[1] : null,
  };
  if (wantDishes) {
    out.dishes = parseYelpDishesFromHtml_(html);
  }
  return out;
}

function fetchYelpDishes_(bizId, bizUrl, apiKey) {
  if (bizId && apiKey) {
    var detailUrl = 'https://api.yelp.com/v3/businesses/' + encodeURIComponent(bizId);
    var resp = UrlFetchApp.fetch(detailUrl, {
      headers: { Authorization: 'Bearer ' + apiKey },
      muteHttpExceptions: true,
    });
    if (resp.getResponseCode() === 200) {
      var data = JSON.parse(resp.getContentText());
      if (data.categories && data.categories.length) {
        // No dish list in API — try business page
      }
    }
  }
  if (bizUrl) {
    try {
      var html = UrlFetchApp.fetch(bizUrl, {
        muteHttpExceptions: true,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Hunt4Food/1.0)' },
        followRedirects: true,
      }).getContentText();
      var dishes = parseYelpDishesFromHtml_(html);
      if (dishes.length) return dishes;
    } catch (e) {
      // fall through
    }
  }
  return [];
}

function parseYelpDishesFromHtml_(html) {
  var dishes = [];
  var patterns = [
    /"popularDishes":\s*\[([^\]]{10,2000})\]/,
    /"popularItems":\s*\[([^\]]{10,2000})\]/,
    /"recommendedDishes":\s*\[([^\]]{10,2000})\]/,
  ];
  for (var i = 0; i < patterns.length; i++) {
    var block = html.match(patterns[i]);
    if (block) {
      var nameRe = /"(?:name|title|displayName)":"([^"]+)"/g;
      var m;
      while ((m = nameRe.exec(block[1])) !== null && dishes.length < 3) {
        var n = m[1].replace(/\\u0026/g, '&');
        if (n.length > 2 && n.length < 60 && dishes.indexOf(n) === -1) dishes.push(n);
      }
      if (dishes.length) return dishes.slice(0, 3);
    }
  }
  var altRe = /"menuItemName":"([^"]+)"/g;
  var m2;
  while ((m2 = altRe.exec(html)) !== null && dishes.length < 3) {
    if (dishes.indexOf(m2[1]) === -1) dishes.push(m2[1]);
  }
  return dishes.slice(0, 3);
}

function fetchGoogle_(name, city, lat, lon, clientKey) {
  var props = PropertiesService.getScriptProperties();
  var fallbackUrl =
    'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(name + ' ' + city);
  var ua =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  // Server-side key only — browser keys are referrer-locked and hang the proxy.
  var apiKey = props.getProperty('GOOGLE_PLACES_API_KEY');
  if (apiKey) {
    var apiResult = fetchGooglePlaces_(name, city, lat, lon, apiKey, fallbackUrl);
    if (apiResult && apiResult.rating != null) return apiResult;
  }

  var queries = [
    name + ' ' + city + ' google maps restaurant',
    '"' + name + '" ' + city + ' site:google.com/maps restaurant',
  ];
  for (var q = 0; q < queries.length; q++) {
    var parsed = fetchGoogleFromDdg_(queries[q], fallbackUrl, ua);
    if (parsed && parsed.rating != null) return parsed;
  }

  var bingUrl =
    'https://www.bing.com/search?q=' + encodeURIComponent(name + ' ' + city + ' site:google.com/maps restaurant');
  var bingHtml = UrlFetchApp.fetch(bingUrl, {
    muteHttpExceptions: true,
    headers: { 'User-Agent': ua },
  }).getContentText();
  parsed = parseGoogleSnippet_(bingHtml, fallbackUrl, name);
  if (parsed && parsed.rating != null) return parsed;

  return {
    rating: null,
    reviewCount: null,
    url: fallbackUrl,
    priceLevel: null,
    error: apiKey ? null : undefined,
  };
}

function fetchGooglePlaces_(name, city, lat, lon, apiKey, fallbackUrl) {
  var body = {
    textQuery: (name + ' ' + city).trim(),
    maxResultCount: 1,
  };
  if (!isNaN(lat) && !isNaN(lon)) {
    body.locationBias = {
      circle: {
        center: { latitude: lat, longitude: lon },
        radius: 500,
      },
    };
  }

  var resp = UrlFetchApp.fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask':
        'places.displayName,places.rating,places.userRatingCount,places.googleMapsUri,places.priceLevel',
    },
    payload: JSON.stringify(body),
    muteHttpExceptions: true,
  });

  if (resp.getResponseCode() !== 200) return null;

  var data = JSON.parse(resp.getContentText());
  var hit = data.places && data.places[0];
  if (!hit) return null;

  return {
    rating: hit.rating != null ? hit.rating : null,
    reviewCount: hit.userRatingCount != null ? hit.userRatingCount : null,
    url: hit.googleMapsUri || fallbackUrl,
    priceLevel: hit.priceLevel != null ? hit.priceLevel : null,
    matchedName: hit.displayName && hit.displayName.text ? hit.displayName.text : null,
  };
}

function fetchGoogleFromDdg_(query, searchFallback, ua) {
  var ddgUrl = 'https://html.duckduckgo.com/html/?q=' + encodeURIComponent(query);
  var html = UrlFetchApp.fetch(ddgUrl, {
    muteHttpExceptions: true,
    headers: { 'User-Agent': ua },
  }).getContentText();
  return parseGoogleSnippet_(html, searchFallback, query);
}

function parseGoogleSnippet_(html, searchFallback, nameHint) {
  if (!html) return null;
  var text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ');

  var hint = String(nameHint || '').toLowerCase();
  var hintToken = hint.split(/\s+/).filter(function (t) {
    return t.length > 3;
  })[0];
  if (hintToken && text.toLowerCase().indexOf(hintToken) < 0) return null;

  var ratingMatch =
    text.match(/(\d+\.?\d*)\s*(?:stars?|★)/i) ||
    text.match(/rated\s+(\d+\.?\d*)\s+out\s+of\s+5/i) ||
    text.match(/(\d+\.?\d*)\s+on\s+Google/i);
  var countMatch = text.match(/(\d[\d,]*)\s+(?:Google\s+)?reviews/i);
  var linkMatch = html.match(/uddg=(https[^&"'\\]*google\.com\/maps[^&"'\\]*)/i);
  if (!linkMatch) {
    linkMatch = html.match(/href="(https:\/\/(?:www\.)?google\.com\/maps\/place[^"]+)"/i);
  }

  var url = searchFallback;
  if (linkMatch) {
    try {
      url = decodeURIComponent(linkMatch[1].replace(/&amp;/g, '&'));
    } catch (e) {
      url = linkMatch[1].replace(/&amp;/g, '&');
    }
  }

  if (!ratingMatch) return null;
  var rating = Number(ratingMatch[1]);
  if (rating < 1 || rating > 5) return null;

  return {
    rating: rating,
    reviewCount: countMatch ? Number(String(countMatch[1]).replace(/,/g, '')) : null,
    url: url,
    priceLevel: null,
  };
}

function fetchTripAdvisor_(name, city) {
  var searchFallback =
    'https://www.tripadvisor.com/Search?q=' + encodeURIComponent(name + ' ' + city + ' restaurant');
  var ua =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  var queries = [
    name + ' ' + city + ' tripadvisor restaurant',
    '"' + name + '" ' + city + ' site:tripadvisor.com restaurant',
  ];

  for (var q = 0; q < queries.length; q++) {
    var parsed = fetchTripAdvisorFromDdg_(queries[q], searchFallback, ua);
    if (parsed && parsed.rating != null) return parsed;
  }

  // Bing fallback
  var bingUrl =
    'https://www.bing.com/search?q=' + encodeURIComponent(name + ' ' + city + ' site:tripadvisor.com restaurant');
  var bingHtml = UrlFetchApp.fetch(bingUrl, {
    muteHttpExceptions: true,
    headers: { 'User-Agent': ua },
  }).getContentText();
  parsed = parseTripAdvisorSnippet_(bingHtml, searchFallback);
  if (parsed && parsed.rating != null) return parsed;

  return { rating: null, reviewCount: null, url: searchFallback };
}

function fetchTripAdvisorFromDdg_(query, searchFallback, ua) {
  var ddgUrl = 'https://html.duckduckgo.com/html/?q=' + encodeURIComponent(query);
  var html = UrlFetchApp.fetch(ddgUrl, {
    muteHttpExceptions: true,
    headers: { 'User-Agent': ua },
  }).getContentText();
  return parseTripAdvisorSnippet_(html, searchFallback);
}

function parseTripAdvisorSnippet_(html, searchFallback) {
  var text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ');

  var ratingMatch = text.match(/rated\s+(\d+(?:\.\d+)?)\s+of\s+5\s+on\s+Tripadvisor/i);
  var countMatch = text.match(/See\s+(\d[\d,]*)\s+unbiased reviews/i);
  var linkMatch = html.match(/uddg=(https[^&"'\\]*tripadvisor\.com[^&"'\\]*Restaurant_Review[^&"'\\]*)/i);
  if (!linkMatch) {
    linkMatch = html.match(/href="(https:\/\/www\.tripadvisor\.com\/Restaurant_Review[^"]+)"/i);
  }

  var url = searchFallback;
  if (linkMatch) {
    try {
      url = decodeURIComponent(linkMatch[1].replace(/&amp;/g, '&'));
    } catch (e) {
      url = linkMatch[1].replace(/&amp;/g, '&');
    }
  }

  if (!ratingMatch) return null;

  return {
    rating: Number(ratingMatch[1]),
    reviewCount: countMatch ? Number(String(countMatch[1]).replace(/,/g, '')) : null,
    url: url,
  };
}

var HEALTHY_UA_ =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function yelpSearchRequest_(apiKey, term, categories, lat, lon, radius) {
  var url =
    'https://api.yelp.com/v3/businesses/search?term=' +
    encodeURIComponent(term) +
    '&latitude=' +
    lat +
    '&longitude=' +
    lon +
    '&radius=' +
    radius +
    '&limit=10&categories=' +
    encodeURIComponent(categories);
  return {
    url: url,
    method: 'get',
    muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + apiKey },
  };
}

function ddgRequest_(query) {
  return {
    url: 'https://html.duckduckgo.com/html/?q=' + encodeURIComponent(query),
    method: 'get',
    muteHttpExceptions: true,
    headers: { 'User-Agent': HEALTHY_UA_ },
  };
}

function googleHealthySearchRequest_(apiKey, query, lat, lon) {
  return {
    url: 'https://places.googleapis.com/v1/places:searchText',
    method: 'post',
    contentType: 'application/json',
    headers: {
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask':
        'places.id,places.displayName,places.rating,places.userRatingCount,places.googleMapsUri,places.priceLevel,places.location,places.formattedAddress,places.types,places.editorialSummary',
    },
    payload: JSON.stringify({
      textQuery: query,
      maxResultCount: 10,
      locationBias: {
        circle: {
          center: { latitude: lat, longitude: lon },
          radius: 8000,
        },
      },
    }),
    muteHttpExceptions: true,
  };
}

function mapYelpBiz_(biz, lane) {
  var coords = biz.coordinates || {};
  var loc = biz.location || {};
  return {
    id: biz.id || '',
    name: biz.name || '',
    lat: coords.latitude != null ? coords.latitude : null,
    lon: coords.longitude != null ? coords.longitude : null,
    address: (loc.display_address || []).join(', ') || loc.address1 || '',
    rating: biz.rating || null,
    reviewCount: biz.review_count || null,
    price: biz.price || null,
    url: biz.url || null,
    categories: (biz.categories || []).map(function (c) {
      return c.alias || c.title || '';
    }).filter(Boolean),
    phone: biz.display_phone || biz.phone || null,
    lane: lane,
    source: 'yelp',
  };
}

function parseYelpSearch_(resp, lane) {
  if (!resp || resp.getResponseCode() !== 200) return [];
  try {
    var data = JSON.parse(resp.getContentText());
    return (data.businesses || []).map(function (biz) {
      return mapYelpBiz_(biz, lane);
    });
  } catch (e) {
    return [];
  }
}

function parseGoogleHealthy_(resp) {
  if (!resp || resp.getResponseCode() !== 200) return [];
  try {
    var data = JSON.parse(resp.getContentText());
    return (data.places || []).map(function (hit) {
      var loc = hit.location || {};
      var summary = hit.editorialSummary && hit.editorialSummary.text ? hit.editorialSummary.text : '';
      return {
        id: hit.id || '',
        name: hit.displayName && hit.displayName.text ? hit.displayName.text : '',
        lat: loc.latitude != null ? loc.latitude : null,
        lon: loc.longitude != null ? loc.longitude : null,
        address: hit.formattedAddress || '',
        rating: hit.rating != null ? hit.rating : null,
        reviewCount: hit.userRatingCount != null ? hit.userRatingCount : null,
        priceLevel: hit.priceLevel || null,
        url: hit.googleMapsUri || null,
        categories: hit.types || [],
        editorialSummary: summary,
        lane: null,
        source: 'google',
      };
    });
  } catch (e) {
    return [];
  }
}

function parseKeywordSnippets_(html, source) {
  if (!html) return [];
  var out = [];
  var snippetRe = /class="result__snippet"[^>]*>([\s\S]*?)<\/(?:a|td|span|div)>/gi;
  var m;
  while ((m = snippetRe.exec(html)) !== null && out.length < 8) {
    var text = String(m[1])
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (text.length > 20) out.push({ text: text.slice(0, 280), url: null, source: source });
  }

  var otRe = /https?:\/\/(?:www\.)?opentable\.com\/[^\s"'&<>]+/gi;
  var ot;
  while ((ot = otRe.exec(html)) !== null && out.length < 12) {
    out.push({ text: '', url: ot[0].replace(/&amp;/g, '&'), source: 'opentable' });
  }

  if (source === 'tripadvisor') {
    var taRe = /https?:\/\/(?:www\.)?tripadvisor\.com\/[^\s"'&<>]+/gi;
    var ta;
    while ((ta = taRe.exec(html)) !== null && out.length < 12) {
      out.push({ text: '', url: ta[0].replace(/&amp;/g, '&'), source: 'tripadvisor' });
    }
  }

  if (out.length) return out;

  var plain = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ');
  var keys = [
    'grass-fed',
    'grass fed',
    'avocado oil',
    'pasture',
    'seed oil',
    'smoothie',
    'salmon',
    'chicken breast',
  ];
  for (var i = 0; i < keys.length; i++) {
    var idx = plain.toLowerCase().indexOf(keys[i]);
    if (idx >= 0) {
      var start = Math.max(0, idx - 80);
      var end = Math.min(plain.length, idx + 140);
      out.push({ text: plain.slice(start, end).trim(), url: null, source: source });
    }
  }
  return out.slice(0, 8);
}

function dedupeHealthyPlaces_(places) {
  var seen = {};
  var out = [];
  for (var i = 0; i < places.length; i++) {
    var p = places[i];
    if (!p || !p.name) continue;
    var key = p.id
      ? String(p.source || '') + ':' + p.id
      : String(p.name)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '');
    if (seen[key]) continue;
    seen[key] = true;
    out.push(p);
  }
  return out;
}

function fetchHealthyDiscover_(city, lat, lon, radiusRaw) {
  var radius = parseInt(radiusRaw, 10);
  if (isNaN(radius) || radius < 500) radius = 8000;
  if (radius > 40000) radius = 40000;

  var props = PropertiesService.getScriptProperties();
  var yelpKey = props.getProperty('YELP_API_KEY');
  var googleKey = props.getProperty('GOOGLE_PLACES_API_KEY');
  var requests = [];
  var tags = [];

  if (yelpKey && !isNaN(lat) && !isNaN(lon)) {
    requests.push(
      yelpSearchRequest_(yelpKey, 'grass-fed avocado oil', 'salad,newamerican,healthmarkets', lat, lon, radius),
    );
    tags.push('yelp_clean');
    requests.push(yelpSearchRequest_(yelpKey, 'smoothie acai juice', 'juicebars,acaibowls', lat, lon, radius));
    tags.push('yelp_smoothie');
    requests.push(
      yelpSearchRequest_(
        yelpKey,
        'healthy salmon grilled chicken breast',
        'seafood,mediterranean,poke',
        lat,
        lon,
        radius,
      ),
    );
    tags.push('yelp_protein');
  }

  requests.push(ddgRequest_('grass-fed OR "avocado oil" restaurant ' + city + ' site:opentable.com'));
  tags.push('ddg_opentable');
  requests.push(
    ddgRequest_(
      'grass-fed OR "avocado oil" OR "pasture-raised" restaurant ' + city + ' site:tripadvisor.com',
    ),
  );
  tags.push('ddg_tripadvisor');
  requests.push(ddgRequest_(city + ' restaurant "grass-fed" OR "pasture-raised" OR "avocado oil" review'));
  tags.push('ddg_reviews');

  if (googleKey && !isNaN(lat) && !isNaN(lon)) {
    requests.push(
      googleHealthySearchRequest_(
        googleKey,
        'healthy restaurants grass-fed avocado oil smoothie salmon ' + city,
        lat,
        lon,
      ),
    );
    tags.push('google');
  }

  if (!requests.length) {
    return { places: [], snippets: [], error: 'No discovery sources configured' };
  }

  var responses = UrlFetchApp.fetchAll(requests);
  var places = [];
  var snippets = [];

  for (var i = 0; i < responses.length; i++) {
    var tag = tags[i];
    var resp = responses[i];
    if (tag === 'yelp_clean') places = places.concat(parseYelpSearch_(resp, 'clean_cooking'));
    else if (tag === 'yelp_smoothie') places = places.concat(parseYelpSearch_(resp, 'smoothie'));
    else if (tag === 'yelp_protein') places = places.concat(parseYelpSearch_(resp, 'protein'));
    else if (tag === 'google') places = places.concat(parseGoogleHealthy_(resp));
    else if (tag === 'ddg_opentable') snippets = snippets.concat(parseKeywordSnippets_(resp.getContentText(), 'opentable'));
    else if (tag === 'ddg_tripadvisor') snippets = snippets.concat(parseKeywordSnippets_(resp.getContentText(), 'tripadvisor'));
    else if (tag === 'ddg_reviews') snippets = snippets.concat(parseKeywordSnippets_(resp.getContentText(), 'google_snippet'));
  }

  return {
    places: dedupeHealthyPlaces_(places),
    snippets: snippets.slice(0, 16),
  };
}

function fetchHealthyReviews_(idsCsv, city, namesCsv) {
  var ids = String(idsCsv || '')
    .split(',')
    .map(function (s) {
      return s.trim();
    })
    .filter(Boolean)
    .slice(0, 12);
  var names = String(namesCsv || '').split('|');
  var props = PropertiesService.getScriptProperties();
  var yelpKey = props.getProperty('YELP_API_KEY');
  var reviews = {};

  if (yelpKey && ids.length) {
    var reqs = ids.map(function (id) {
      return {
        url: 'https://api.yelp.com/v3/businesses/' + encodeURIComponent(id) + '/reviews?limit=3',
        method: 'get',
        muteHttpExceptions: true,
        headers: { Authorization: 'Bearer ' + yelpKey },
      };
    });
    var responses = UrlFetchApp.fetchAll(reqs);
    var needFallback = [];
    for (var i = 0; i < ids.length; i++) {
      var resp = responses[i];
      var code = resp.getResponseCode();
      if (code === 200) {
        try {
          var data = JSON.parse(resp.getContentText());
          reviews[ids[i]] = (data.reviews || []).map(function (r) {
            return {
              text: r.text || '',
              url: r.url || null,
              rating: r.rating != null ? r.rating : null,
            };
          });
        } catch (e) {
          needFallback.push(i);
        }
      } else {
        needFallback.push(i);
      }
    }

    if (needFallback.length) {
      var ddgReqs = [];
      var ddgIdx = [];
      for (var f = 0; f < needFallback.length; f++) {
        var ni = needFallback[f];
        var nm = names[ni] || ids[ni];
        if (!nm) continue;
        ddgReqs.push(
          ddgRequest_('"' + nm + '" ' + city + ' (grass-fed OR "avocado oil" OR pasture) review'),
        );
        ddgIdx.push(ids[ni]);
      }
      if (ddgReqs.length) {
        var ddgRes = UrlFetchApp.fetchAll(ddgReqs);
        for (var d = 0; d < ddgRes.length; d++) {
          var snips = parseKeywordSnippets_(ddgRes[d].getContentText(), 'google_snippet');
          reviews[ddgIdx[d]] = snips.map(function (s) {
            return { text: s.text || '', url: s.url || null, rating: null };
          });
        }
      }
    }
  }

  return { reviews: reviews };
}
