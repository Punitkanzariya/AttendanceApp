import React from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView } from 'react-native';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={styles.container}>
          <Text style={styles.title}>Oops! Application Crashed</Text>
          <Text style={styles.subtitle}>Please take a screenshot of this error.</Text>
          <ScrollView style={styles.errorBox}>
            <Text style={styles.errorText}>
              {this.state.error?.message || this.state.error?.toString()}
            </Text>
            {this.state.error?.stack && (
              <Text style={styles.stackText}>{this.state.error.stack}</Text>
            )}
          </ScrollView>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 20, 
    backgroundColor: '#fff' 
  },
  title: { 
    fontSize: 22, 
    fontWeight: 'bold', 
    color: '#D32F2F', 
    marginBottom: 5,
    marginTop: 40
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20
  },
  errorBox: { 
    flex: 1, 
    width: '100%', 
    padding: 15, 
    backgroundColor: '#FFF3F3', 
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFCDD2'
  },
  errorText: { 
    color: '#B71C1C',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10
  },
  stackText: {
    color: '#333',
    fontSize: 12,
    fontFamily: 'monospace'
  }
});
