import React from 'react';
import {
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import {useTranslation} from 'react-i18next';
import {translateText as tr} from '../i18n';
import {useVisualTheme} from '../visual/theme';

const KIND_LABELS = {
  text: 'Text',
  uri: 'Link',
  unknown: 'Unknown record',
  malformed: 'Malformed record',
  unsupported: 'Unsupported record',
};
const REASONS = {
  'invalid-record': 'The supplied record is invalid.',
  'invalid-tnf': 'The record TNF is invalid.',
  'invalid-type': 'The record type bytes are invalid.',
  'invalid-payload': 'The record payload bytes are invalid.',
  'invalid-id': 'The record ID bytes are invalid.',
  'invalid-text': 'The Text record could not be decoded as valid UTF-8.',
  'invalid-uri': 'The URI record does not contain a valid link.',
  utf16: 'UTF-16 text is not decoded. Its original bytes are preserved.',
  unrecognized:
    'This record type has no readable preview. Its original bytes are preserved.',
};

function TechnicalField({label, value, styles, bytes = false}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text selectable style={styles.technical}>
        {value === null
          ? tr('Unavailable')
          : value === ''
          ? tr(bytes ? '(empty bytes)' : '(empty value)')
          : String(value)}
      </Text>
    </View>
  );
}

// Rendering consumes the pure presentation result; no NFC decoder or RF access belongs here.
function NdefMessage({presentation, technical = false, colors}) {
  useTranslation();
  const theme = useVisualTheme();
  const styles = makeStyles(colors || theme.colors, theme.spacing, theme.type);
  const [expanded, setExpanded] = React.useState(false);
  const [feedback, setFeedback] = React.useState(null);
  const mounted = React.useRef(false);
  const generation = React.useRef(0);
  React.useLayoutEffect(() => {
    mounted.current = true;
    generation.current += 1;
    setExpanded(false);
    setFeedback(null);
    return () => {
      mounted.current = false;
      generation.current += 1;
    };
  }, [presentation]);

  const p = presentation;
  const number = p.index + 1;
  const hasContent =
    (p.kind === 'text' || p.kind === 'uri') && p.content !== null;
  // Only previews have a line limit. A short URI always renders its complete target,
  // even when narrow width or large fonts make it wrap to more than six lines.
  const longContent =
    hasContent &&
    (p.content.length > 240 || p.content.split(/\r\n|\r|\n/).length > 6);
  const clipped = longContent && !expanded;
  const kindLabel =
    p.kind === 'mime'
      ? p.mimeKind === 'wifi'
        ? 'Wi-Fi data'
        : p.mimeKind === 'contact'
        ? 'Contact data'
        : 'MIME data'
      : KIND_LABELS[p.kind];

  async function perform(action) {
    const token = ++generation.current;
    setFeedback(null);
    try {
      if (action === 'copy') {
        await Clipboard.setString(p.content);
      } else {
        await Linking.openURL(p.content);
      }
      if (mounted.current && generation.current === token) {
        setFeedback(action === 'copy' ? 'copied' : null);
      }
    } catch (_) {
      if (mounted.current && generation.current === token) {
        setFeedback(action === 'copy' ? 'copy-failed' : 'open-failed');
      }
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>
        {tr('Record {{number}} · {{kind}}', {number, kind: tr(kindLabel)})}
      </Text>
      {technical ? (
        <>
          <TechnicalField label="TNF" value={p.tnf} styles={styles} />
          <TechnicalField
            label={tr('Record type')}
            value={p.type}
            styles={styles}
          />
          <TechnicalField
            label={tr('Language')}
            value={p.language}
            styles={styles}
          />
          <TechnicalField
            label={tr('Encoding')}
            value={p.encoding}
            styles={styles}
          />
          <TechnicalField
            label={tr('Payload byte count')}
            value={p.payloadByteCount}
            styles={styles}
          />
          <TechnicalField
            label={tr('Type hex')}
            value={p.typeHex}
            styles={styles}
            bytes
          />
          <TechnicalField
            label={tr('ID hex')}
            value={p.idHex}
            styles={styles}
            bytes
          />
          <TechnicalField
            label={tr('Payload hex')}
            value={p.payloadHex}
            styles={styles}
            bytes
          />
        </>
      ) : (
        <>
          {hasContent ? (
            <>
              <Text
                selectable
                numberOfLines={clipped ? 6 : undefined}
                style={styles.content}
              >
                {p.content === '' ? tr('(empty text)') : p.content}
              </Text>
              {longContent && (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={tr('Full content for record {{number}}', {
                    number,
                  })}
                  accessibilityState={{expanded}}
                  onPress={() => setExpanded((current) => !current)}
                  style={styles.action}
                >
                  <Text style={styles.actionText}>
                    {tr(expanded ? 'Show less' : 'Show full content')}
                  </Text>
                </TouchableOpacity>
              )}
              <View style={styles.actions}>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={tr('Copy content for record {{number}}', {
                    number,
                  })}
                  onPress={() => perform('copy')}
                  style={styles.action}
                >
                  <Text style={styles.actionText}>{tr('Copy content')}</Text>
                </TouchableOpacity>
                {p.kind === 'uri' && !clipped && (
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={tr('Open link for record {{number}}', {
                      number,
                    })}
                    onPress={() => perform('open')}
                    style={styles.action}
                  >
                    <Text style={styles.actionText}>{tr('Open link')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </>
          ) : (
            <>
              {p.kind === 'mime' && (
                <>
                  <Text selectable style={styles.technical}>
                    {p.type}
                  </Text>
                  <Text style={styles.note}>
                    {tr(
                      'MIME payload is preserved without decoding its contents.',
                    )}
                  </Text>
                </>
              )}
              {p.reason && (
                <Text style={styles.note}>{tr(REASONS[p.reason])}</Text>
              )}
              <Text style={styles.note}>
                {tr(
                  'Available bytes remain in Technical details and Raw tag JSON.',
                )}
              </Text>
            </>
          )}
          {feedback && (
            <Text
              accessibilityLiveRegion="polite"
              style={feedback === 'copied' ? styles.success : styles.error}
            >
              {tr(
                feedback === 'copied'
                  ? 'Copied to clipboard.'
                  : feedback === 'copy-failed'
                  ? 'Could not copy. Try again.'
                  : 'Could not open this link. You can still copy the target.',
              )}
            </Text>
          )}
        </>
      )}
    </View>
  );
}

function makeStyles(colors, spacing, type) {
  return StyleSheet.create({
    card: {
      padding: spacing.lg,
      marginBottom: spacing.md,
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
    },
    title: {
      color: colors.accent,
      fontSize: type.label,
      fontWeight: '700',
      marginBottom: spacing.md,
    },
    content: {color: colors.text, fontSize: type.title, lineHeight: 30},
    note: {
      color: colors.textMuted,
      fontSize: type.body,
      lineHeight: 22,
      marginTop: spacing.sm,
    },
    field: {marginTop: spacing.sm},
    fieldLabel: {
      color: colors.textMuted,
      fontSize: type.caption,
      marginBottom: spacing.xs,
    },
    technical: {
      color: colors.technical,
      fontSize: type.body,
      lineHeight: 22,
      fontFamily: Platform.select({ios: 'Menlo', default: 'monospace'}),
    },
    actions: {flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm},
    action: {
      minHeight: 48,
      justifyContent: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      marginTop: spacing.sm,
    },
    actionText: {color: colors.accent, fontSize: type.body, fontWeight: '600'},
    success: {
      color: colors.success,
      fontSize: type.body,
      marginTop: spacing.sm,
    },
    error: {color: colors.danger, fontSize: type.body, marginTop: spacing.sm},
  });
}

export default NdefMessage;
