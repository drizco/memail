import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

enum OverlayStatus { sending, sent, error }

class _BouncingDot extends StatelessWidget {
  final Animation<double> animation;

  const _BouncingDot({required this.animation});

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: animation,
      builder: (context, child) {
        return Transform.translate(
          offset: Offset(0, -animation.value),
          child: Text(
            '.',
            style: GoogleFonts.nunito(
              fontSize: 28,
              fontWeight: FontWeight.w800,
              fontStyle: FontStyle.italic,
              color: const Color(0xFF222222),
            ),
          ),
        );
      },
    );
  }
}

class SendingOverlay extends StatefulWidget {
  final OverlayStatus status;
  final String? url;

  const SendingOverlay({
    super.key,
    required this.status,
    this.url,
  });

  @override
  State<SendingOverlay> createState() => _SendingOverlayState();
}

class _SendingOverlayState extends State<SendingOverlay>
    with TickerProviderStateMixin {
  late final AnimationController _dotController;
  late final List<Animation<double>> _dotAnimations;
  late final AnimationController _fadeController;
  late final Animation<double> _fadeAnimation;

  @override
  void initState() {
    super.initState();

    _dotController = AnimationController(
      duration: const Duration(milliseconds: 900),
      vsync: this,
    )..repeat();

    _dotAnimations = List.generate(3, (i) {
      final start = i * 0.2;
      final end = (start + 0.4).clamp(0.0, 1.0);
      return TweenSequence<double>([
        TweenSequenceItem(tween: Tween(begin: 0, end: 5), weight: 1),
        TweenSequenceItem(tween: Tween(begin: 5, end: 0), weight: 1),
      ]).animate(CurvedAnimation(
        parent: _dotController,
        curve: Interval(start, end, curve: Curves.easeInOut),
      ));
    });

    _fadeController = AnimationController(
      duration: const Duration(milliseconds: 300),
      vsync: this,
    )..forward();

    _fadeAnimation = CurvedAnimation(
      parent: _fadeController,
      curve: Curves.easeOut,
    );
  }

  @override
  void dispose() {
    _dotController.dispose();
    _fadeController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _fadeAnimation,
      child: Container(
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
                  offset: Offset(0, 3),
                  blurRadius: 6,
                ),
                BoxShadow(
                  color: Color(0x3B000000),
                  offset: Offset(0, 3),
                  blurRadius: 6,
                ),
              ],
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (widget.status == OverlayStatus.sending) ...[
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        'Sending',
                        style: GoogleFonts.nunito(
                          fontSize: 28,
                          fontWeight: FontWeight.w800,
                          fontStyle: FontStyle.italic,
                          color: const Color(0xFF222222),
                        ),
                      ),
                      ...List.generate(
                        3,
                        (i) => _BouncingDot(animation: _dotAnimations[i]),
                      ),
                    ],
                  ),
                ],
                if (widget.status == OverlayStatus.sent)
                  Text(
                    'MEmail sent!',
                    style: GoogleFonts.nunito(
                      fontSize: 28,
                      fontWeight: FontWeight.w800,
                      fontStyle: FontStyle.italic,
                      color: const Color(0xFF222222),
                    ),
                  ),
                if (widget.status == OverlayStatus.error)
                  Text(
                    'uh oh, something went wrong...',
                    style: GoogleFonts.nunito(
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                      fontStyle: FontStyle.italic,
                      color: const Color(0xFFC8261E),
                    ),
                  ),
                if (widget.url != null) ...[
                  const SizedBox(height: 8),
                  SizedBox(
                    width: 240,
                    child: Text(
                      widget.url!,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      textAlign: TextAlign.center,
                      style: GoogleFonts.nunito(
                        fontSize: 13,
                        color: const Color(0xFF888888),
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
