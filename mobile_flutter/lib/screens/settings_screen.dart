import 'package:flutter/material.dart';
import '../services/storage.dart' as storage;
import '../services/api.dart' as api;

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final _controller = TextEditingController();
  bool _saving = false;
  bool _loaded = false;

  @override
  void initState() {
    super.initState();
    _loadEmail();
  }

  Future<void> _loadEmail() async {
    final stored = await storage.getEmail();
    if (stored != null) _controller.text = stored;
    if (mounted) setState(() => _loaded = true);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _handleSave() async {
    final trimmed = _controller.text.trim();
    if (trimmed.isEmpty || !trimmed.contains('@')) {
      if (!mounted) return;
      showDialog(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Invalid email'),
          content: const Text('Please enter a valid email address.'),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('OK'),
            ),
          ],
        ),
      );
      return;
    }

    FocusScope.of(context).unfocus();
    setState(() => _saving = true);
    await storage.saveEmail(trimmed);

    final args =
        ModalRoute.of(context)?.settings.arguments as Map<String, String>?;
    final pendingUrl = args?['pendingUrl'];
    final pendingTitle = args?['pendingTitle'];

    if (pendingUrl != null) {
      final success =
          await api.sendMeMail(trimmed, pendingTitle ?? pendingUrl, pendingUrl);
      if (!mounted) return;
      setState(() => _saving = false);

      showDialog(
        context: context,
        builder: (ctx) => AlertDialog(
          title: Text(success ? 'Sent!' : 'Error'),
          content: Text(success
              ? 'MEmail sent successfully.'
              : 'Failed to send email. Please try again.'),
          actions: [
            TextButton(
              onPressed: () {
                Navigator.pop(ctx);
                if (success) Navigator.pop(context);
              },
              child: const Text('OK'),
            ),
          ],
        ),
      );
    } else {
      if (!mounted) return;
      setState(() => _saving = false);
      Navigator.pop(context);
    }
  }

  @override
  Widget build(BuildContext context) {
    final args =
        ModalRoute.of(context)?.settings.arguments as Map<String, String>?;
    final hasPending = args?['pendingUrl'] != null;

    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: !_loaded
          ? const SizedBox.shrink()
          : Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text(
                    'Your email address',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w500,
                      color: Color(0xFF222222),
                    ),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _controller,
                    keyboardType: TextInputType.emailAddress,
                    autocorrect: false,
                    autofocus: _controller.text.isEmpty,
                    textCapitalization: TextCapitalization.none,
                    decoration: InputDecoration(
                      hintText: 'you@example.com',
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                      contentPadding: const EdgeInsets.all(14),
                    ),
                    style: const TextStyle(fontSize: 16, color: Color(0xFF222222)),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Shared links will be emailed to this address.',
                    style: TextStyle(fontSize: 13, color: Color(0xFF999999)),
                  ),
                  const SizedBox(height: 24),
                  ElevatedButton(
                    onPressed: _saving ? null : _handleSave,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFE52929),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.all(16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                      disabledBackgroundColor:
                          const Color(0xFFE52929).withValues(alpha: 0.6),
                    ),
                    child: Text(
                      _saving
                          ? 'Saving...'
                          : hasPending
                              ? 'Save & Send'
                              : 'Save',
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
            ),
    );
  }
}
