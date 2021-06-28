import * as React from 'react';
import {Image} from 'react-native';

function NfcIcon() {
  return (
    <Image
      source={require('../../images/nfc-512.png')}
      style={{width: 44, height: 44}}
      resizeMode="contain"
    />
  );
}

function TxtIcon() {
  return (
    <Image
      source={require('../../images/RD_text_A512.png')}
      style={{width: 44, height: 44}}
      resizeMode="contain"
    />
  );
}

function UriIcon() {
  return (
    <Image
      source={require('../../images/RD_uri_A512.png')}
      style={{width: 44, height: 44}}
      resizeMode="contain"
    />
  );
}

function EmailIcon() {
  return (
    <Image
      source={require('../../images/RD_email_A512.png')}
      style={{width: 44, height: 44}}
      resizeMode="contain"
    />
  );
}

function SmsIcon() {
  return (
    <Image
      source={require('../../images/RD_sms_A512.png')}
      style={{width: 44, height: 44}}
      resizeMode="contain"
    />
  );
}

function TelIcon() {
  return (
    <Image
      source={require('../../images/RD_tel_A512.png')}
      style={{width: 44, height: 44}}
      resizeMode="contain"
    />
  );
}

function WifiIcon() {
  return (
    <Image
      source={require('../../images/RD_wifi_A512.png')}
      style={{width: 44, height: 44}}
      resizeMode="contain"
    />
  );
}

function EraseIcon() {
  return (
    <Image
      source={require('../../images/RD_clear_A512.png')}
      style={{width: 44, height: 44}}
      resizeMode="contain"
    />
  );
}

function TransceiveIcon() {
  return (
    <Image
      source={require('../../images/RD_transceive_A512.png')}
      style={{width: 44, height: 44}}
      resizeMode="contain"
    />
  );
}

function MimeIcon() {
  return (
    <Image
      source={require('../../images/RD_mime_A512.png')}
      style={{width: 44, height: 44}}
      resizeMode="contain"
    />
  );
}

function ContactIcon() {
  return (
    <Image
      source={require('../../images/RD_contact_A512.png')}
      style={{width: 44, height: 44}}
      resizeMode="contain"
    />
  );
}

export {
  NfcIcon,
  TxtIcon,
  UriIcon,
  EmailIcon,
  SmsIcon,
  TelIcon,
  WifiIcon,
  EraseIcon,
  TransceiveIcon,
  MimeIcon,
  ContactIcon,
};
