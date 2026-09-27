const NDEF_FORMAT_GROUPS = [
  {
    title: 'Well Known',
    choices: [
      {title: 'Text', description: 'Write text into NFC tags', icon: 'text-box-outline', params: {ndefType: 'TEXT'}},
      {title: 'Link', description: 'Write web link or uri into NFC tags', icon: 'link-variant', params: {ndefType: 'URI'}},
      {title: 'TEL', description: 'Write number into NFC tags to make phone call', icon: 'phone-outline', params: {ndefType: 'URI', scheme: 'tel:'}},
      {title: 'SMS', description: 'Write number into NFC tags to send SMS', icon: 'message-text-outline', params: {ndefType: 'URI', scheme: 'sms:'}},
      {title: 'EMAIL', description: 'Write email into NFC tags', icon: 'email-outline', params: {ndefType: 'URI', scheme: 'mailto:'}},
    ],
  },
  {
    title: 'MIME',
    choices: [
      {title: 'WiFi Simple Record', description: 'Connect to your WiFi AP', icon: 'wifi', params: {ndefType: 'WIFI_SIMPLE'}},
      {title: 'vCard', description: 'Write contact records. Please be aware vCard format is not supported by iOS natively', icon: 'card-account-details-outline', params: {ndefType: 'VCARD'}},
    ],
  },
];

export {NDEF_FORMAT_GROUPS};
