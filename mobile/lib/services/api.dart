import 'dart:convert';
import 'package:http/http.dart' as http;

const _apiUrl =
    'https://api.memail.drizco.dev/send';

class SendResult {
  final bool success;
  final String? title;
  final String? url;

  SendResult({required this.success, this.title, this.url});
}

Future<SendResult> sendMeMail(String idToken, String url) async {
  try {
    final response = await http.post(
      Uri.parse('$_apiUrl?format=json'),
      headers: {
        'Content-Type': 'application/json;charset=UTF-8',
        'Authorization': 'Bearer $idToken',
      },
      body: jsonEncode({'url': url}),
    );
    if (response.statusCode == 200) {
      final data = jsonDecode(response.body) as Map<String, dynamic>;
      return SendResult(
        success: true,
        title: data['title'] as String?,
        url: data['url'] as String?,
      );
    }
    return SendResult(success: false);
  } catch (_) {
    return SendResult(success: false);
  }
}
