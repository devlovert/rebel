const normalizePhoneNumber = value => String(value || '').replace(/\D/g, '');

module.exports = { normalizePhoneNumber };
