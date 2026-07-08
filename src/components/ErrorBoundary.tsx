import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface Props {
     children: ReactNode;
}

interface State {
     hasError: boolean;
     error: Error | null;
}

/**
 * Top-level Error Boundary — catches any unhandled JS errors in the component
 * tree and shows a user-friendly fallback screen instead of a white crash.
 */
export class ErrorBoundary extends Component<Props, State> {
     constructor(props: Props) {
          super(props);
          this.state = { hasError: false, error: null };
     }

     static getDerivedStateFromError(error: Error): State {
          return { hasError: true, error };
     }

     componentDidCatch(error: Error, info: ErrorInfo) {
          // In production this would go to Sentry.
          // In dev we log to console for debugging.
          if (__DEV__) {
               console.error('[ErrorBoundary] Caught error:', error, info);
          }
     }

     handleReset = () => {
          this.setState({ hasError: false, error: null });
     };

     render() {
          if (this.state.hasError) {
               return (
                    <View style={styles.container}>
                         <Text style={styles.title}>Something went wrong</Text>
                         <Text style={styles.subtitle}>
                              The app ran into an unexpected problem. Please try again.
                         </Text>
                         {__DEV__ && this.state.error && (
                              <Text style={styles.devError}>{this.state.error.message}</Text>
                         )}
                         <TouchableOpacity style={styles.button} onPress={this.handleReset}>
                              <Text style={styles.buttonText}>Try Again</Text>
                         </TouchableOpacity>
                    </View>
               );
          }

          return this.props.children;
     }
}

const styles = StyleSheet.create({
     container: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          backgroundColor: '#0f172a',
     },
     title: {
          fontSize: 22,
          fontWeight: '700',
          color: '#f1f5f9',
          marginBottom: 12,
          textAlign: 'center',
     },
     subtitle: {
          fontSize: 15,
          color: '#94a3b8',
          textAlign: 'center',
          marginBottom: 24,
          lineHeight: 22,
     },
     devError: {
          fontSize: 12,
          color: '#f87171',
          backgroundColor: '#1e293b',
          padding: 12,
          borderRadius: 8,
          marginBottom: 24,
          fontFamily: 'monospace',
          width: '100%',
     },
     button: {
          backgroundColor: '#6366f1',
          paddingVertical: 14,
          paddingHorizontal: 32,
          borderRadius: 12,
     },
     buttonText: {
          color: '#fff',
          fontWeight: '600',
          fontSize: 16,
     },
});
