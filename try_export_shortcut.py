import pyautogui
import time

# Try Ctrl+P for print/export
pyautogui.hotkey('ctrl', 'p')
time.sleep(2)
print("Tried Ctrl+P for export/print")