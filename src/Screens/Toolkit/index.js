import * as React from 'react';
import {Pressable, ScrollView, StatusBar, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-screens/experimental';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {getToolkitActionGroups} from '../../features/toolkit/actionGroups';
import {actionNotice} from '../../features/toolkit/actionNotice';
import {useVisualTheme} from '../../visual/theme';

function ToolkitRow({action, colors, styles}) {
  const notice = actionNotice(action.title);
  const isMemoryScan = action.title === 'Type 2 Memory Scan';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[action.title, action.description, notice].filter(Boolean).join('. ')}
      onPress={action.onPress}
      style={({pressed}) => [styles.row, pressed && {backgroundColor: colors.surfaceMuted}]}
    >
      <View style={styles.iconBox}>
        {isMemoryScan ? (
          <Icon name="nfc" size={28} color={colors.accent} />
        ) : action.left ? (
          React.createElement(action.left)
        ) : (
          <Icon name="wrench-outline" size={28} color={colors.accent} />
        )}
      </View>
      <View style={styles.rowContent}>
        <Text style={styles.rowTitle}>{action.title}</Text>
        {!!action.description && <Text style={styles.rowDescription}>{action.description}</Text>}
        {!!notice && <Text style={styles.notice}>{notice}</Text>}
      </View>
    </Pressable>
  );
}

function ToolKitScreen({navigation}) {
  const groups = getToolkitActionGroups({navigation});
  const {colors, spacing, type, isDark} = useVisualTheme();
  const styles = React.useMemo(() => makeStyles(colors, spacing, type), [colors, spacing, type]);

  return (
    <SafeAreaView edges={{top: true, bottom: true}} style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>NFC TOOLKIT</Text>
          <Text style={styles.subtitle}>Advanced NFC tools for tag maintenance and testing.</Text>
        </View>
        {groups.map((group) => (
          <View key={group.title} style={styles.group}>
            <Text style={styles.groupTitle}>{group.title}</Text>
            {group.actions.map((action, index) => (
              <ToolkitRow key={`${action.title}-${index}`} action={action} colors={colors} styles={styles} />
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors, spacing, type) {
  return StyleSheet.create({
    container: {flex: 1, backgroundColor: colors.background},
    scroll: {flex: 1},
    content: {paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl},
    header: {paddingTop: spacing.xl, paddingBottom: spacing.xl},
    title: {color: colors.text, fontSize: type.hero, fontWeight: '800'},
    subtitle: {color: colors.textMuted, fontSize: type.body, marginTop: spacing.sm},
    group: {marginBottom: spacing.xl},
    groupTitle: {color: colors.text, fontSize: type.label, fontWeight: '800', borderBottomColor: colors.border, borderBottomWidth: 1, paddingBottom: spacing.sm},
    row: {flexDirection: 'row', alignItems: 'center', minHeight: 72, borderBottomColor: colors.border, borderBottomWidth: 1, paddingVertical: spacing.md},
    iconBox: {width: 48, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md},
    rowContent: {flex: 1},
    rowTitle: {color: colors.text, fontSize: type.label, fontWeight: '700'},
    rowDescription: {color: colors.textMuted, fontSize: type.body, marginTop: spacing.xs},
    notice: {color: colors.danger, fontSize: type.caption, fontWeight: '700', marginTop: spacing.xs},
  });
}

export default ToolKitScreen;
