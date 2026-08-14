/**
 * OpenPlate ratings proxy — deploy at script.google.com
 *
 * 1. New project → paste this file → Save
 * 2. Project Settings → Script properties:
 *    - YELP_API_KEY (optional, recommended): https://www.yelp.com/developers
 * 3. Deploy → New deployment → Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 4. Copy the /exec URL into GitHub environment secret VITE_RATINGS_PROXY_URL
 */

function doGet(e) {
  var p = e && e.parameter ? e.parameter : {};
  var source = String(p.source || '');
  var name = String(p.name || '');
  var city = String(p.city || '');
  var lat = parseFloat(p.lat);
  var lon = parseFloat(p.lon);
  var callback = p.callback;

  var result;
  try {
    if (source === 'yelp') {
      result = fetchYelp_(name, city, lat, lon);
    } else if (source === 'tripadvisor') {
      result = fetchTripAdvisor_(name, city);
    } else {
      result = { error: 'Unknown source. Use yelp or tripadvisor.' };
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

function fetchYelp_(name, city, lat, lon) {
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
        return {
          rating: biz.rating || null,
          reviewCount: biz.review_count || null,
          url: biz.url || searchUrl,
        };
      }
    }
  }

  // Scrape fallback (may fail if Yelp blocks datacenter IP)
  var html = UrlFetchApp.fetch(searchUrl, {
    muteHttpExceptions: true,
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OpenPlate/1.0)' },
  }).getContentText();
  var ratingMatch = html.match(/"rating":\s*(\d+(?:\.\d+)?)/);
  var countMatch = html.match(/"reviewCount":\s*(\d+)/);
  var bizMatch = html.match(/href="(\/biz\/[^"?]+)/);
  return {
    rating: ratingMatch ? Number(ratingMatch[1]) : null,
    reviewCount: countMatch ? Number(countMatch[1]) : null,
    url: bizMatch ? 'https://www.yelp.com' + bizMatch[1] : searchUrl,
  };
}

function fetchTripAdvisor_(name, city) {
  var searchUrl =
    'https://www.tripadvisor.com/Search?q=' + encodeURIComponent(name + ' ' + city + ' restaurant');
  var html = UrlFetchApp.fetch(searchUrl, {
    muteHttpExceptions: true,
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OpenPlate/1.0)' },
  }).getContentText();

  var bubble = html.match(/bubble_rating rating-(\d+)/);
  var rating = bubble ? Number(bubble[1]) / 10 : null;
  if (!rating) {
    var jsonRating = html.match(/"rating":\s*(\d+(?:\.\d+)?)/);
    if (jsonRating) rating = Number(jsonRating[1]);
  }
  var countMatch = html.match(/(\d[\d,]*)\s+reviews/i) || html.match(/"num_reviews":\s*(\d+)/);
  var linkMatch = html.match(/href="(https:\/\/www\.tripadvisor\.com\/Restaurant_Review[^"]+)"/);
  return {
    rating: rating,
    reviewCount: countMatch ? Number(String(countMatch[1]).replace(/,/g, '')) : null,
    url: linkMatch ? linkMatch[1].replace(/&amp;/g, '&') : searchUrl,
  };
}
