import pyautogui
import time

# Try to navigate to see the actual PDF chord layout
# Let me close this menu first by clicking outside or trying to find the main view
pyautogui.click(300, 200)  # Click in main area
time.sleep(1)
print("Clicked to navigate to main PDF view")