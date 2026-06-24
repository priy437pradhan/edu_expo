/* registerForm.js
 * Wires the #regForm block in the Long Hall design:
 *   - segmented tabs (.reg-tab[data-track])
 *   - per-track select label/options + org requirement
 *   - validation + submit (delegated to window.ExpoService)
 * ES5-compatible. Load AFTER expoService.js.
 */
(function () {
  'use strict';

  // data-track value in the HTML -> config. `endpoint` maps to ExpoService.ENDPOINTS.
  var TRACKS = {
   visit: {
      endpoint: 'attend',
      label: 'I am a',
      orgRequired: false,
      field: 'i_am_a',
      options: ['Student', 'Parent / Guardian', 'Educator', 'Other'],
      success: 'You are registered. We will share event details with you shortly.'
    },
    stall: {
      endpoint: 'stall',
      label: 'Stall type',
      orgRequired: true,
      field: 'stall_type',
      options: ['Standard stall', 'Premium stall', 'Corner stall'],
      success: 'Your stall enquiry has been received. The team will reach out within 24 hours.'
    },
    sponsor: {
      endpoint: 'sponsor',
      label: 'Sponsorship interest',
      orgRequired: true,
      field: 'sponsorship_interest',
      options: ['Title sponsor', 'Co-title sponsor', 'Track sponsor'],
      success: 'Your sponsorship enquiry has been received. The team will reach out within 24 hours.'
    }
  };

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function init() {
    var form = document.getElementById('regForm');
    if (!form) return;

    var tabs       = form.querySelectorAll('.reg-tab');
    var nameInput  = document.getElementById('f-name');
    var phoneInput = document.getElementById('f-phone');
    var emailInput = document.getElementById('f-email');
    var orgInput   = document.getElementById('f-org');
    var typeLabel  = document.getElementById('f-type-label');
    var typeSelect = document.getElementById('f-type');
    var msgInput   = document.getElementById('f-msg');
    var submitBtn  = form.querySelector('button[type="submit"]');
    var thanks     = document.getElementById('formThanks');
    var thanksText = thanks ? thanks.querySelector('p') : null;

    var currentTrack = 'visit';

    // Error box reuses the existing .form-error style in styles.css.
    var errorBox = document.createElement('div');
    errorBox.className = 'form-error';
    submitBtn.parentNode.insertBefore(errorBox, submitBtn.nextSibling);

    function trim(s) { return (s || '').replace(/^\s+|\s+$/g, ''); }
    function fieldOf(input) { return input.parentNode; }
    function clearError(input) {
      var f = fieldOf(input);
      f.className = f.className.replace(/\s*invalid/g, '');
    }
    function markError(input) {
      var f = fieldOf(input);
      if (f.className.indexOf('invalid') === -1) f.className += ' invalid';
    }
    function hideError() { errorBox.style.display = 'none'; }
    function showError(msg) { errorBox.textContent = msg; errorBox.style.display = 'block'; }

    function cleanPhone(raw) {
      var p = (raw || '').replace(/\D/g, '');
      if (p.length > 10) p = p.slice(-10); // tolerate +91 / leading 0
      return p;
    }

    function applyTrack(track) {
      currentTrack = track;
      var cfg = TRACKS[track];

      for (var i = 0; i < tabs.length; i++) {
        tabs[i].setAttribute('aria-selected',
          tabs[i].getAttribute('data-track') === track ? 'true' : 'false');
      }

      typeLabel.textContent = cfg.label;
      var html = '';
      for (var j = 0; j < cfg.options.length; j++) {
        html += '<option>' + cfg.options[j] + '</option>';
      }
      typeSelect.innerHTML = html;

      clearError(orgInput);
    }

    function validate() {
      var ok = true;

      if (!trim(nameInput.value)) { markError(nameInput); ok = false; } else clearError(nameInput);

      if (!/^[0-9]{10}$/.test(cleanPhone(phoneInput.value))) { markError(phoneInput); ok = false; } else clearError(phoneInput);

      if (!EMAIL_RE.test(trim(emailInput.value))) { markError(emailInput); ok = false; } else clearError(emailInput);

      if (TRACKS[currentTrack].orgRequired && !trim(orgInput.value)) {
        markError(orgInput); ok = false;
      } else clearError(orgInput);

      return ok;
    }

    function setLoading(state) {
      submitBtn.disabled = state;
      submitBtn.firstChild.nodeValue = state ? 'Submitting\u2026 ' : 'Submit Enquiry ';
    }

    function submit() {
      console.log('[regForm] submit fired, track =', currentTrack);
      hideError();

      if (!validate()) {
        showError('Please fill in the highlighted fields correctly.');
        return;
      }

      var cfg = TRACKS[currentTrack];

      // ---- Payload sent to the API ------------------------------------
      // Match these keys to your Django serializer fields. The track-specific
      // value lands under cfg.field: attendee_type / stall_type / sponsorship_tier.
      var payload = {
        name: trim(nameInput.value),
        phone: cleanPhone(phoneInput.value),
        email: trim(emailInput.value),
       institution_organisation: trim(orgInput.value),
        message: trim(msgInput.value)
      };
      payload[cfg.field] = typeSelect.value;
      // -----------------------------------------------------------------

      if (typeof ExpoService === 'undefined') {
        showError('Service not loaded — make sure expoService.js is included before registerForm.js.');
        return;
      }

      setLoading(true);

      ExpoService.submitEnquiry(
        cfg.endpoint,
        payload,
        function onSuccess() {
          setLoading(false);
          if (thanksText) thanksText.textContent = cfg.success;
          var kids = form.children;
          for (var i = 0; i < kids.length; i++) {
            if (kids[i].id !== 'formThanks') kids[i].style.display = 'none';
          }
          thanks.style.display = 'block';
        },
        function onError(data, status) {
          setLoading(false);
          var msg = (data && data.message)
            ? data.message
            : (status === 0
                ? 'Network error — please check your connection and try again.'
                : 'Something went wrong. Please try again.');
          showError(msg);
        }
      );
    }

    for (var t = 0; t < tabs.length; t++) {
      (function (tab) {
        tab.addEventListener('click', function () { applyTrack(tab.getAttribute('data-track')); });
      })(tabs[t]);
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      submit();
    });

    applyTrack('visit');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();