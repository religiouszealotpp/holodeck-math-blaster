import http.server
import socketserver
import os
import socket
import sys
import datetime
import urllib.parse

# Default Port 1558 (or override via CLI e.g. "python serve_mobile.py 1558")
PORT = int(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1].isdigit() else 1558
DIRECTORY = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dist")

class DebugHTTPHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        # Allow cross-origin and prevent caching during active development
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, format, *args):
        now = datetime.datetime.now().strftime('%H:%M:%S')
        client_ip = self.client_address[0]
        msg = format % args
        # Colorize output
        status_code = args[1] if len(args) > 1 else ''
        if '200' in str(status_code) or '304' in str(status_code):
            color = '\033[92m' # Green
        elif '404' in str(status_code):
            color = '\033[91m' # Red
        else:
            color = '\033[93m' # Yellow
        reset = '\033[0m'
        print(f"[{now}] 📱 [{client_ip}] {color}{msg}{reset}")

    def do_GET(self):
        user_agent = self.headers.get('User-Agent', 'Unknown')
        # Check if Android / Mobile device
        device_tag = "📱 [Mobile/Android]" if ("Android" in user_agent or "Mobile" in user_agent or "iPhone" in user_agent) else "💻 [Desktop/Browser]"
        now = datetime.datetime.now().strftime('%H:%M:%S')
        print(f"[{now}] 📡 INCOMING GET {device_tag} -> {self.path}")
        super().do_GET()

    def handle_one_request(self):
        try:
            super().handle_one_request()
        except Exception as e:
            err_str = str(e)
            if "\x16\x03" in err_str or "SSL" in err_str or "TLS" in err_str:
                now = datetime.datetime.now().strftime('%H:%M:%S')
                print(f"[{now}] ⚠️ [HTTPS / SSL WARNING] A device connected with HTTPS instead of HTTP!")
                print(f"       👉 Please ensure your mobile browser is navigating to: http://{get_ip()}:{PORT} (explicitly 'http://', not 'https://')")
            else:
                print(f"⚠️ [Connection Notice]: {e}")

def get_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('10.255.255.255', 1))
        IP = s.getsockname()[0]
    except Exception:
        IP = '127.0.0.1'
    finally:
        s.close()
    return IP

class ThreadingTCPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True
    daemon_threads = True

if __name__ == '__main__':
    local_ip = get_ip()
    print("=" * 70)
    print("  🚀 HOLODECK MATH BLASTER — MOBILE / ANDROID TEST SERVER")
    print("=" * 70)
    print(f"  📂 Serving Directory: {DIRECTORY}")
    print(f"  💻 Local PC URL:      http://localhost:{PORT}")
    print(f"  📱 Android Phone URL: http://{local_ip}:{PORT}")
    print("=" * 70)
    print("  🔍 QUICK START FOR ANDROID / MOBILE:")
    print(f"  1. Ensure your phone is connected to the same Wi-Fi network.")
    print(f"  2. In Chrome on Android, navigate to:")
    print(f"     👉 http://{local_ip}:{PORT}")
    print(f"  3. Tap Chrome Menu (⋮) -> 'Add to Home screen' / 'Install' to play full-screen!")
    print("=" * 70)
    print("  📡 Real-time traffic log will appear below as devices connect...\n")

    try:
        with ThreadingTCPServer(("0.0.0.0", PORT), DebugHTTPHandler) as httpd:
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n🛑 Server stopped.")
    except Exception as ex:
        print(f"❌ Failed to start server on port {PORT}: {ex}")
