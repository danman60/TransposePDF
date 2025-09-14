import pyautogui
import time

# Click on Chrome icon in taskbar (approximate position based on the screenshot)
pyautogui.click(490, 530)  # Chrome icon position in taskbar
time.sleep(2)
print("Clicked Chrome icon")