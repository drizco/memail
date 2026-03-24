import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:share_intent_package/share_intent_package.dart';
import '../models/history_entry.dart';
import '../services/api.dart' as api;
import '../services/auth.dart' as auth;
import '../services/storage.dart' as storage;
import '../components/history_item.dart';
import '../components/sending_overlay.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  List<HistoryEntry> _history = [];
  OverlayStatus? _overlayStatus;
  String? _overlayUrl;
  StreamSubscription? _intentSub;

  @override
  void initState() {
    super.initState();
    _refreshHistory();
    _initSharing();
  }

  Future<void> _initSharing() async {
    await ShareIntentPackage.instance.init();

    // Handle share intent that launched the app
    final initial = await ShareIntentPackage.instance.getInitialSharing();
    if (initial != null && initial.hasContent) {
      _handleSharedData(initial);
    }

    // Handle share intents when app is already running
    _intentSub =
        ShareIntentPackage.instance.getMediaStream().listen(_handleSharedData);
  }

  @override
  void dispose() {
    _intentSub?.cancel();
    super.dispose();
  }

  Future<void> _refreshHistory() async {
    final history = await storage.getHistory();
    if (mounted) setState(() => _history = history);
  }

  void _handleSharedData(SharedData data) {
    final url = data.text ?? '';
    if (url.isEmpty) return;

    _handleShareIntent(url);
  }

  Future<void> _handleShareIntent(String url) async {
    final idToken = await auth.getIdToken();

    if (!mounted) return;

    if (idToken == null) return;

    setState(() {
      _overlayUrl = url;
      _overlayStatus = OverlayStatus.sending;
    });

    final success = await api.sendMeMail(idToken, url);
    final status = success ? 'success' : 'error';

    await storage.addHistoryEntry(HistoryEntry(
      id: DateTime.now().millisecondsSinceEpoch.toString(),
      title: url,
      url: url,
      timestamp: DateTime.now().millisecondsSinceEpoch,
      status: status,
    ));

    if (!mounted) return;

    setState(() {
      _overlayStatus = success ? OverlayStatus.sent : OverlayStatus.error;
    });

    await _refreshHistory();

    await Future.delayed(const Duration(milliseconds: 1500));
    if (success) {
      SystemNavigator.pop();
    }
    if (mounted) {
      setState(() {
        _overlayStatus = null;
        _overlayUrl = null;
      });
    }
  }

  Future<void> _handleDelete(String id) async {
    await storage.deleteHistoryEntry(id);
    await _refreshHistory();
  }

  Future<void> _handleClearAll() async {
    await storage.clearHistory();
    if (mounted) setState(() => _history = []);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Image.asset('assets/memail_logo.png', width: 28, height: 28),
            const SizedBox(width: 8),
            const Text('MEmail'),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.settings, size: 22),
            onPressed: () async {
              await Navigator.pushNamed(context, '/settings');
              _refreshHistory();
            },
          ),
        ],
      ),
      body: Stack(
        children: [
          _history.isEmpty
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(32),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Image.asset(
                          'assets/memail_logo.png',
                          width: 64,
                          height: 64,
                          opacity: const AlwaysStoppedAnimation(0.3),
                        ),
                        const SizedBox(height: 16),
                        const Text(
                          'No emails sent yet',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w500,
                            color: Color(0xFF666666),
                          ),
                        ),
                        const SizedBox(height: 8),
                        const Text(
                          'Share a link from any app to get started',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 14,
                            color: Color(0xFFAAAAAA),
                          ),
                        ),
                      ],
                    ),
                  ),
                )
              : Column(
                  children: [
                    Expanded(
                      child: ListView.builder(
                        padding: const EdgeInsets.only(top: 8, bottom: 8),
                        itemCount: _history.length,
                        itemBuilder: (context, index) => HistoryItem(
                          entry: _history[index],
                          onDelete: _handleDelete,
                        ),
                      ),
                    ),
                    Container(
                      color: Colors.white,
                      child: TextButton(
                        onPressed: _handleClearAll,
                        style: TextButton.styleFrom(
                          padding: const EdgeInsets.all(16),
                          minimumSize: const Size(double.infinity, 0),
                        ),
                        child: const Text(
                          'Clear All',
                          style: TextStyle(
                            fontSize: 16,
                            color: Color(0xFFC8261E),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
          if (_overlayStatus != null)
            SendingOverlay(status: _overlayStatus!, url: _overlayUrl),
        ],
      ),
    );
  }
}
