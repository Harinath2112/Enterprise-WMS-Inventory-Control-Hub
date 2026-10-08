export const PINCODE_MAX_LENGTH = 6

export const VALID_INDIAN_2DIGIT_PREFIXES = new Set([
  '11', '12', '13', '14', '15', '16', '17', '18', '19',
  '20', '21', '22', '23', '24', '25', '26', '27', '28',
  '30', '31', '32', '33', '34', '36', '37', '38', '39',
  '40', '41', '42', '43', '44', '45', '46', '47', '48', '49',
  '50', '51', '52', '53', '56', '57', '58', '59',
  '60', '61', '62', '63', '64', '67', '68', '69',
  '70', '71', '72', '73', '74', '75', '76', '77', '78', '79',
  '80', '81', '82', '83', '84', '85',
])

export const STATE_PINCODE_PREFIXES = {
  'Andaman And Nicobar Islands': ['744'],
  'Andhra Pradesh': [
    '515', '516', '517', '518',
    '520', '521', '522', '523', '524',
    '530', '531', '532', '533', '534', '535',
  ],
  'Arunachal Pradesh': ['790', '791', '792'],
  Assam: ['78'],
  Bihar: [
    '800', '801', '802', '803', '804', '805',
    '811', '812', '813', '821',
    '841', '842', '843', '844', '845', '846', '847', '848',
    '851', '852', '853', '854', '855',
  ],
  Chandigarh: ['160'],
  Chhattisgarh: ['49'],
  'Dadra And Nagar Haveli And Daman And Diu': ['396'],
  Delhi: ['11'],
  Goa: ['403'],
  Gujarat: ['36', '37', '38', '390', '391', '392', '393', '394', '395'],
  Haryana: ['12', '13'],
  'Himachal Pradesh': ['17'],
  'Jammu And Kashmir': ['18', '190', '191', '192', '193'],
  Jharkhand: [
    '814', '815', '816',
    '822', '823', '825', '826', '827', '828', '829',
    '831', '832', '833', '834', '835',
  ],
  Karnataka: ['56', '57', '58', '59'],
  Kerala: ['67', '680', '681', '683', '684', '685', '686', '687', '688', '689', '69'],
  Ladakh: ['194'],
  Lakshadweep: ['682'],
  'Madhya Pradesh': ['45', '46', '47', '48'],
  Maharashtra: ['400', '401', '402', '404', '405', '41', '42', '43', '44'],
  Manipur: ['795'],
  Meghalaya: ['793', '794'],
  Mizoram: ['796'],
  Nagaland: ['797', '798'],
  Odisha: ['75', '76', '77'],
  Puducherry: ['605'],
  Punjab: ['14', '15', '161', '162', '163'],
  Rajasthan: ['30', '31', '32', '33', '34'],
  Sikkim: ['737'],
  'Tamil Nadu': ['600', '601', '602', '603', '604', '606', '607', '608', '609', '61', '62', '63', '64'],
  Telangana: ['500', '501', '502', '503', '504', '505', '506', '507', '508', '509'],
  Tripura: ['799'],
  'Uttar Pradesh': ['20', '21', '22', '23', '241', '242', '243', '244', '245', '247', '25', '261', '262', '27', '28'],
  Uttarakhand: ['246', '248', '249', '263'],
  'West Bengal': ['70', '71', '72', '73', '74'],
}

const INVALID_PATTERNS = new Set([
  '012345', '123456', '234567', '345678', '456789',
  '543210', '654321', '765432', '876543', '987654',
])

export function sanitizePincodeInput(value, country = 'India') {
  const isIndia = String(country || 'India').trim().toLowerCase() === 'india'
  if (isIndia) {
    return String(value ?? '').replace(/\D/g, '').slice(0, PINCODE_MAX_LENGTH)
  }
  return String(value ?? '').toUpperCase().replace(/[^A-Z0-9 -]/g, '').slice(0, 12)
}

export function isIndiaCountry(value) {
  const rawCountry = typeof value === 'object' && value !== null
    ? value.value ?? value.label ?? value.name ?? value.Name ?? ''
    : value
  return String(rawCountry ?? '').trim().toLowerCase() === 'india'
}

export function normalizeStateName(state) {
  const rawState = typeof state === 'object' && state !== null
    ? state.value ?? state.label ?? state.name ?? state.Name ?? ''
    : state
  return String(rawState ?? '').trim()
}

export function isValidIndianPincodeFormat(pincode) {
  const cleanPincode = String(pincode ?? '').trim()
  if (!/^[1-9]\d{5}$/.test(cleanPincode)) {
    return false
  }

  // Reject repeating digits (e.g. 000000, 111111, 999999)
  if (/^(\d)\1{5}$/.test(cleanPincode)) {
    return false
  }

  // Reject known sequential patterns
  if (INVALID_PATTERNS.has(cleanPincode)) {
    return false
  }

  // Check valid postal circle 2-digit prefix
  const circlePrefix = cleanPincode.slice(0, 2)
  if (!VALID_INDIAN_2DIGIT_PREFIXES.has(circlePrefix)) {
    return false
  }

  // Check Hyderabad 500xxx delivery office range (500001 to 500118)
  if (cleanPincode.startsWith('500')) {
    const deliveryOffice = Number(cleanPincode.slice(3))
    if (deliveryOffice === 0 || deliveryOffice > 118) {
      return false
    }
  }

  return true
}

export function getStateForPincode(pincode) {
  const cleanPincode = String(pincode ?? '').trim()
  if (!isValidIndianPincodeFormat(cleanPincode)) {
    return null
  }

  for (const [stateName, prefixes] of Object.entries(STATE_PINCODE_PREFIXES)) {
    if (prefixes.some((prefix) => cleanPincode.startsWith(prefix))) {
      return stateName
    }
  }

  return null
}

export function getPincodeStateError(pincode, state, country = 'India') {
  const cleanPincode = String(pincode ?? '').trim()
  const cleanState = normalizeStateName(state)

  if (!isIndiaCountry(country) || !cleanPincode) {
    return ''
  }

  // Format check
  if (!isValidIndianPincodeFormat(cleanPincode)) {
    return 'Enter a valid 6-digit pincode.'
  }

  // If no state is provided yet, format has passed
  if (!cleanState) {
    return ''
  }

  const matchingStateKey = Object.keys(STATE_PINCODE_PREFIXES).find(
    (key) => key.toLowerCase() === cleanState.toLowerCase()
  )

  if (!matchingStateKey) {
    return ''
  }

  const prefixes = STATE_PINCODE_PREFIXES[matchingStateKey] || []
  if (prefixes.length > 0 && !prefixes.some((prefix) => cleanPincode.startsWith(prefix))) {
    return 'Pincode does not belong to the selected state.'
  }

  return ''
}

export function getPincodeError(pincode, state, country = 'India', options = {}) {
  const { required = false } = options
  const cleanPincode = String(pincode ?? '').trim()
  const isIndia = isIndiaCountry(country)

  if (!cleanPincode) {
    return required ? 'Pincode is required.' : ''
  }

  if (isIndia) {
    if (!/^\d{6}$/.test(cleanPincode)) {
      return 'Enter a valid 6-digit pincode.'
    }

    const stateError = getPincodeStateError(cleanPincode, state, country)
    if (stateError) {
      return stateError
    }

    if (!isValidIndianPincodeFormat(cleanPincode)) {
      return 'Enter a valid 6-digit pincode.'
    }

    return ''
  }

  // International postal code
  if (!/^[A-Za-z0-9 -]{3,12}$/.test(cleanPincode)) {
    return 'Postal code must be 3 to 12 characters.'
  }

  return ''
}
