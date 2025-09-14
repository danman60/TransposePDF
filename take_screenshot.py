import pyautogui
import time
import sys

# Take screenshot
screenshot = pyautogui.screenshot()
filename = sys.argv[1] if len(sys.argv) > 1 else 'screenshot.png'
screenshot.save(f'D:/ClaudeCode/{filename}')
print(f"Screenshot saved as {filename}")