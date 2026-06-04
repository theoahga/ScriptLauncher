#!/usr/bin/env python3

import sys
from datetime import datetime

print("🎉 Hello from Script Launcher!")
print("=" * 32)
print("Cet script Python a été exécuté avec succès.")
print()
print("Date et heure actuelle:")
print(datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
print()
print("Version Python:")
print(sys.version)
print()
print("✅ Script terminé!")
