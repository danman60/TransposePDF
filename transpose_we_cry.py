import pyautogui
import time

# Click the sharp button for "We cry" (second song) twice
# First click
pyautogui.click(188, 177)  # Sharp button for We cry
time.sleep(0.5)
# Second click  
pyautogui.click(188, 177)  # Sharp button for We cry again
time.sleep(1)
print("Clicked sharp button twice for We cry")