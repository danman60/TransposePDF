import pyautogui
import time

# Click the flat button for "King Of Heaven" (first song)
# Looking at the screenshot, the flat button is to the left of the sharp button
pyautogui.click(130, 113)  # Flat button for King Of Heaven
time.sleep(1)
print("Clicked flat button for King Of Heaven")