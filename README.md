<p align="center">
  <img alt="react-native-nfc-rewriter" src="./images/nfc-rewriter-icon.png" width="300">
</p>
<p align="center">
  <h2 align="center">NFC Open ReWriter</h2>
</p>

<br/>

<p align="center">
  This open source React Native NFC app allows read & write to NFC tags. 
</p>

<p align="center">
  Made with ❤️ by ihashing.hk
</p>

<table align="center">
<tr>
  <td>
      <img alt="read" src="./images/nfc-app-read.gif" width="200">
      <h3 align="center">Read</h3>
  </td>
  <td>
      <img alt="write" src="./images/nfc-app-write.gif" width="200">
      <h3 align="center">Write</h3>
  </td>
</tr>
</table>

<p align="center">
  And much more! 
</p>

<table align="center">
<tr>
  <td>
      <img alt="trans" src="./images/nfc-app-trans.gif" width="200">
      <h3 align="center">Custom commands</h3>
  </td>
  <td>
      <img alt="mine" src="./images/nfc-app-mine.gif" width="200">
      <h3 align="center">Save Your Own Records</h3>
  </td>
</tr>
</table>

<p align="center">
The NFC library is powered by <a href="https://github.com/facebook/react-native">react-native</a> as well as <a href="https://github.com/whitedogg13/react-native-nfc-manager">react-native-nfc-manager</a>
</p>

## Features

- Read NFC tags
  - uid
  - NFC technology
  - NDEF
- Write NDEF
  - RTD_URI
    - url, email, sms, tel, or custom scheme
  - RTD_TEXT
  - WIFI SIMPLE RECORD
- Toolkits
  - NfcA
    - Custom transceive
    - Erase all
    - Format to NDEF
  - NfcV
    - Custom transceive 
  - IsoDep
    - Custom APDU (Android)
  - NdefFormatable (Android)
    - Format to NDEF
- Tag Kit
  - NXP NTAG21X
    - password protection
    - signature verification
  - NXP NTAG424 DNA
    - signature verification   
    - temper detection
  - SIC4310
    - rolling code verification
- Save your own records


