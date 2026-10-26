// Progressive enhancement for the contact form (inlined into the page by scripts/build.mjs).
// Without this script the form still works: it posts straight to Google Forms.
// With it: inline validation, submission in the background, and an in-page confirmation.
(() => {
  const form = document.querySelector('[data-gform]');
  if (!form || !window.fetch || !window.URLSearchParams) return;

  const fields = [...form.querySelectorAll('[data-field]')];
  const trap = form.querySelector('[data-gform-trap]');
  const submit = form.querySelector('[data-gform-submit]');
  const status = document.querySelector('[data-gform-status]');
  const failure = form.querySelector('[data-gform-error]');
  const success = document.querySelector('[data-gform-success]');
  let attempted = false;

  form.noValidate = true;

  const errorFor = (input) => {
    const value = input.value.trim();
    if (input.required && !value) return input.dataset.msgRequired;
    if (value && (input.validity.typeMismatch || input.validity.patternMismatch)) return input.dataset.msgInvalid;
    return '';
  };

  const check = (input) => {
    const message = errorFor(input);
    const box = document.getElementById(`${input.id}-error`);
    box.textContent = message;
    box.hidden = !message;
    input.setAttribute('aria-invalid', String(Boolean(message)));
    return !message;
  };

  // After the first submit attempt, errors update as the visitor fixes them.
  form.addEventListener('input', (event) => {
    if (attempted && event.target.matches('[data-field]')) check(event.target);
  });

  const setBusy = (busy) => {
    submit.disabled = busy;
    form.toggleAttribute('aria-busy', busy);
    submit.classList.toggle('is-busy', busy);
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    attempted = true;
    failure.hidden = true;

    const invalid = fields.filter((input) => !check(input));
    if (invalid.length) {
      status.textContent = `Please check ${invalid.length === 1 ? 'the highlighted field' : `${invalid.length} highlighted fields`}.`;
      invalid[0].focus();
      return;
    }

    // Bots fill in the hidden field; quietly pretend to succeed.
    if (trap.value) return showSuccess();

    const body = new URLSearchParams();
    for (const input of fields) body.append(input.name, input.value.trim());

    setBusy(true);
    status.textContent = 'Sending your message…';
    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(), 15000);
    try {
      // Google Forms doesn't allow reading its reply from another site ("no-cors"),
      // so a completed request is treated as success; network failures show the error.
      await fetch(form.action, { method: 'POST', mode: 'no-cors', body, signal: timeout.signal });
      showSuccess();
    } catch {
      failure.hidden = false;
      status.textContent = failure.textContent.trim();
    } finally {
      clearTimeout(timer);
      setBusy(false);
    }
  });

  function showSuccess() {
    form.reset();
    attempted = false;
    form.hidden = true;
    success.hidden = false;
    status.textContent = '';
    success.focus();
  }

  document.querySelector('[data-gform-again]')?.addEventListener('click', () => {
    success.hidden = true;
    form.hidden = false;
    fields[0].focus();
  });
})();
