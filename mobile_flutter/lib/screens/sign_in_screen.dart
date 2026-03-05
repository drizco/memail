import 'package:flutter/material.dart';
import '../services/auth.dart' as auth;

class SignInScreen extends StatefulWidget {
  const SignInScreen({super.key});

  @override
  State<SignInScreen> createState() => _SignInScreenState();
}

class _SignInScreenState extends State<SignInScreen> {
  bool _loading = false;
  String? _error;

  Future<void> _handleSignIn() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      await auth.signIn();
    } catch (e) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error = 'Sign-in failed. Please try again.';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text(
                'MEmail',
                style: TextStyle(
                  fontSize: 36,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFFE52929),
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Email yourself links in a single tap',
                style: TextStyle(fontSize: 16, color: Color(0xFF888888)),
              ),
              const SizedBox(height: 48),
              ElevatedButton(
                onPressed: _loading ? null : _handleSignIn,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFE52929),
                  foregroundColor: Colors.white,
                  padding:
                      const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                  disabledBackgroundColor:
                      const Color(0xFFE52929).withValues(alpha: 0.6),
                ),
                child: Text(
                  _loading ? 'Signing in...' : 'Sign in with Google',
                  style: const TextStyle(
                      fontSize: 18, fontWeight: FontWeight.w600),
                ),
              ),
              if (_error != null) ...[
                const SizedBox(height: 16),
                Text(
                  _error!,
                  style: const TextStyle(color: Color(0xFFE52929)),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
