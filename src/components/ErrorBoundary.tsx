import React from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, Clipboard } from 'react-native';
import { logCrashToFirestore } from '@/firebase/crashLogger';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  logged: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, logged: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);

    // Log to Firestore with component stack for easier debugging
    logCrashToFirestore(error, 'js_error', true, {
      componentStack: errorInfo.componentStack?.substring(0, 1000) ?? 'N/A',
    });

    this.setState({ logged: true });
  }

  handleCopy = () => {
    const text = `${this.state.error?.message}\n\n${this.state.error?.stack}`;
    Clipboard.setString(text);
  };

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>💥 App Crashed</Text>
            <Text style={styles.subtitle}>
              {this.state.logged
                ? '✅ Error logged to Firebase automatically'
                : '⏳ Logging error...'}
            </Text>
          </View>

          <ScrollView style={styles.errorBox}>
            <Text style={styles.errorText}>
              {this.state.error?.message || this.state.error?.toString()}
            </Text>
            {this.state.error?.stack && (
              <Text style={styles.stackText}>{this.state.error.stack}</Text>
            )}
          </ScrollView>

          <TouchableOpacity style={styles.copyBtn} onPress={this.handleCopy}>
            <Text style={styles.copyBtnTxt}>Copy Error</Text>
          </TouchableOpacity>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  header: {
    marginTop: 40,
    marginBottom: 16,
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#D32F2F',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: '#555',
    textAlign: 'center',
  },
  errorBox: {
    flex: 1,
    padding: 15,
    backgroundColor: '#FFF3F3',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFCDD2',
    marginBottom: 12,
  },
  errorText: {
    color: '#B71C1C',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 10,
  },
  stackText: {
    color: '#333',
    fontSize: 11,
    fontFamily: 'monospace',
  },
  copyBtn: {
    backgroundColor: '#1E293B',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 8,
  },
  copyBtnTxt: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
});
