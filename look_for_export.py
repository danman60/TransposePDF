import pyautogui
import time

# Look for an export button - might be at the top or in a menu
# Let me try right-clicking to see if there's a context menu with export
pyautogui.rightClick(250, 200)
time.sleep(1)
print("Right-clicked to look for export menu")