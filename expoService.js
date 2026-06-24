/* expoService.js
 * Handles all calls to the OTV Education Conclave / Expo enquiry API.
 * ES5-compatible (XHR, callbacks) so it works inside in-app browsers.
 * Exposes a global: window.ExpoService
 */
(function (global) {
  'use strict';

  // One endpoint per registration track.
  var ENDPOINTS = {
    attend:  'https://dev-eventsapi.odishatv.in/api/expo_attend/',
    stall:   'https://dev-eventsapi.odishatv.in/api/expo_book_a_stall/',
    sponsor: 'https://dev-eventsapi.odishatv.in/api/expo_sponsor/'
  };

  function endpointFor(track) {
    return ENDPOINTS[track] || ENDPOINTS.attend;
  }

  /**
   * POST an enquiry to the correct Expo endpoint for the given track.
   * @param {String}   track      'attend' | 'stall' | 'sponsor'
   * @param {Object}   payload    Data to send.
   * @param {Function} onSuccess  Called with (data, status) on a 2xx response.
   * @param {Function} onError    Called with (data, status) on failure; status 0 = network/timeout.
   */
  function submitEnquiry(track, payload, onSuccess, onError) {
    var url = endpointFor(track);
    var xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.timeout = 15000; // surface a hang instead of sitting on "Submitting…" forever

    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;

      var data = null;
      try { data = JSON.parse(xhr.responseText); } catch (e) { data = null; }

      if (xhr.status >= 200 && xhr.status < 300) {
        if (onSuccess) onSuccess(data, xhr.status);
      } else {
        if (onError) onError(data, xhr.status);
      }
    };

    xhr.onerror   = function () { if (onError) onError(null, 0); };
    xhr.ontimeout = function () { if (onError) onError(null, 0); };
    xhr.send(JSON.stringify(payload));
  }

  global.ExpoService = {
    ENDPOINTS: ENDPOINTS,
    endpointFor: endpointFor,
    submitEnquiry: submitEnquiry
  };

})(typeof window !== 'undefined' ? window : this);