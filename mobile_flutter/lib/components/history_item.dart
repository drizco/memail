import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/history_entry.dart';

class HistoryItem extends StatelessWidget {
  final HistoryEntry entry;
  final void Function(String id) onDelete;

  const HistoryItem({
    super.key,
    required this.entry,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    final date = DateTime.fromMillisecondsSinceEpoch(entry.timestamp);
    final timeStr = DateFormat('MMM d, h:mm a').format(date);

    return Container(
      decoration: const BoxDecoration(
        border: Border(
          bottom: BorderSide(color: Color(0xFFE0E0E0), width: 0.5),
        ),
      ),
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  entry.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w500,
                    color: Color(0xFF222222),
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  entry.url,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 13,
                    color: Color(0xFF888888),
                  ),
                ),
                const SizedBox(height: 4),
                RichText(
                  text: TextSpan(
                    text: timeStr,
                    style: const TextStyle(
                      fontSize: 12,
                      color: Color(0xFFAAAAAA),
                    ),
                    children: [
                      if (entry.status == 'error')
                        const TextSpan(
                          text: ' — failed',
                          style: TextStyle(color: Color(0xFFB8221A)),
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          GestureDetector(
            onTap: () => onDelete(entry.id),
            behavior: HitTestBehavior.opaque,
            child: const Padding(
              padding: EdgeInsets.all(10),
              child: Text(
                '✕',
                style: TextStyle(fontSize: 18, color: Color(0xFF999999)),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
