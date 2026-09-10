import * as React from 'react';
import {ScrollView, Text} from 'react-native';
import {Appbar, List} from 'react-native-paper';
import {getToolkitActionGroups} from '../../features/toolkit/actionGroups';

function ToolKitScreen({navigation}) {
  const groups = getToolkitActionGroups({navigation});

  return (
    <>
      <Appbar.Header style={{backgroundColor: 'white'}}>
        <Text style={{marginLeft: 10, fontSize: 24}}>NFC TOOLKIT</Text>
      </Appbar.Header>

      <ScrollView style={{flex: 1, backgroundColor: 'white'}}>
        {groups.map((group) => (
          <List.Section key={group.title}>
            <List.Subheader>{group.title}</List.Subheader>
            {group.actions.map((action) => (
              <List.Item key={action.title} {...action} />
            ))}
          </List.Section>
        ))}
      </ScrollView>
    </>
  );
}

export default ToolKitScreen;
