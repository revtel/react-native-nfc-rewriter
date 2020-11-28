import styled from 'styled-components';

const ActionBtn = styled.TouchableOpacity`
  padding-vertical: 6px;
  padding-horizontal: 10px;
  border-radius: 20px;
  border-width: 1px;
  border-color: black;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  background-color: white;
  margin-bottom: 10px;
  ${(props) => props.css}
`;

const ActionBtnText = styled.Text`
  font-size: 18px;
  ${(props) => props.css}
`;

const PrimaryBtn = styled.TouchableOpacity`
  padding-vertical: 6px;
  padding-horizontal: 10px;
  border-radius: 6px;
  border-width: 1px;
  border-color: teal;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  background-color: teal;
  margin-bottom: 10px;
  ${(props) => props.css}
`;

const PrimaryBtnText = styled.Text`
  font-size: 20px;
  color: white;
  ${(props) => props.css}
`;

export {ActionBtn, ActionBtnText, PrimaryBtn, PrimaryBtnText};
