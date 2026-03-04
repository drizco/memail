import 'package:flutter/material.dart';

enum OverlayStatus { sending, sent, error }

class SendingOverlay extends StatelessWidget {
  final OverlayStatus status;
  final String? url;

  const SendingOverlay({
    super.key,
    required this.status,
    this.url,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      color: Colors.black.withValues(alpha: 0.4),
      child: Center(
        child: Container(
          constraints: const BoxConstraints(minWidth: 220),
          padding: const EdgeInsets.all(32),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            boxShadow: const [
              BoxShadow(
                color: Colors.black26,
                offset: Offset(0, 2),
                blurRadius: 8,
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (status == OverlayStatus.sending) ...[
                const CircularProgressIndicator(
                  color: Color(0xFFE52929),
                ),
                const SizedBox(height: 12),
                const Text(
                  'Sending...',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF222222),
                  ),
                ),
              ],
              if (status == OverlayStatus.sent)
                const Text(
                  'MEmail sent!',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF222222),
                  ),
                ),
              if (status == OverlayStatus.error)
                const Text(
                  'Something went wrong',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFFE52929),
                  ),
                ),
              if (url != null) ...[
                const SizedBox(height: 8),
                SizedBox(
                  width: 240,
                  child: Text(
                    url!,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 13,
                      color: Color(0xFF888888),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
