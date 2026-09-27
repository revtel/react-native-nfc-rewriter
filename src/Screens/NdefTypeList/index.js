import * as React from 'react';
import {Pressable, ScrollView, StatusBar, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-screens/experimental';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {NDEF_FORMAT_GROUPS} from '../../features/ndef-write/formatChoices';
import {useVisualTheme} from '../../visual/theme';

function FormatRow({choice, onPress, colors, styles}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${choice.title}. ${choice.description}`}
      onPress={onPress}
      style={({pressed}) => [styles.row, pressed && {backgroundColor: colors.surfaceMuted}]}>
      <View style={styles.iconBox}>
        <Icon name={choice.icon} size={26} color={colors.accent} />
      </View>
      <View style={styles.rowContent}>
        <Text style={styles.rowTitle}>{choice.title}</Text>
        <Text style={styles.rowDescription}>{choice.description}</Text>
      </View>
      <Icon name="chevron-right" size={22} color={colors.accent} />
    </Pressable>
  );
}

function NdefTypeListScreen({navigation}) {
  const {colors, spacing, type, isDark} = useVisualTheme();
  const styles = React.useMemo(() => makeStyles(colors, spacing, type), [colors, spacing, type]);

  return (
    <SafeAreaView edges={{top: true, bottom: true}} style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>WRITE NDEF</Text>
          <Text style={styles.subtitle}>Choose a record type to write to an NFC tag.</Text>
        </View>
        {NDEF_FORMAT_GROUPS.map((group) => (
          <View key={group.title} style={styles.group}>
            <Text style={styles.groupTitle}>{group.title}</Text>
            {group.choices.map((choice) => (
              <FormatRow
                key={choice.title}
                choice={choice}
                colors={colors}
                styles={styles}
                onPress={() => navigation.navigate('NdefWrite', choice.params)}
              />
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
    iconBox: {width: 44, height: 44, borderRadius: 12, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md},
    rowContent: {flex: 1, paddingRight: spacing.sm},
    rowTitle: {color: colors.text, fontSize: type.label, fontWeight: '700'},
    rowDescription: {color: colors.textMuted, fontSize: type.body, marginTop: spacing.xs},
  });
}

export default NdefTypeListScreen;
