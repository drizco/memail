class HistoryEntry {
  final String id;
  final String title;
  final String url;
  final int timestamp;
  final String status; // "success" or "error"

  HistoryEntry({
    required this.id,
    required this.title,
    required this.url,
    required this.timestamp,
    required this.status,
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'title': title,
        'url': url,
        'timestamp': timestamp,
        'status': status,
      };

  factory HistoryEntry.fromJson(Map<String, dynamic> json) => HistoryEntry(
        id: json['id'] as String,
        title: json['title'] as String,
        url: json['url'] as String,
        timestamp: json['timestamp'] as int,
        status: json['status'] as String,
      );
}
