# ADDR – Automated Drainage Debris Removal System UI DESIGN (SUBJECT TO BE CHANGE)

Monitoring app for **ADDR**, an automated drainage debris removal system for selected drainage channels in Bauan, Batangas.

Each drain has its own ADDR unit (a "node") with an ESP32. All units report to this app, so barangay or MDRRMO personnel can:

- see every drain at a glance (clear, cleaning, obstructed, basket almost full)
- get a **notification with the drain's name and location** when a grate is obstructed
- open one drain to see its cleaning cycle step (Detect → Lift → Drop → Return) and sensors: water level, water flow, ultrasonic (proximity) sensor and limit switches
- view alerts and the cleaning log for all drains (cycles, completed cycles, response time, times a person was needed)
- change detection thresholds and notification settings

> **Status:** UI prototype. All readings are sample values from `js/data.js`.
> The app will show live data once the units are built and connected.

##GROUP 1 BSCPE (NAME OF GROUP TO BE DECIDED)

- AVILES, CHRISTINE MAE
- BICOL, LOURD MARTING
- DE JESUS, ALEXIS

STI COLLEGE BATANGAS · BSCPE 301 · 3rd Year College

## Files

```
index.html        Main page
css/style.css     Colors, layout and styles
js/data.js        Sample data for each drain (replace with real ESP32 readings later)
js/app.js         Screens, notifications and button actions
manifest.json     Lets the app be added to a phone's home screen
img/              Unit image and app icons
```

## Run it on your computer

Open `index.html` in Chrome or Edge. No installation needed.

## Demo steps

1. Tap **Sign in** (any username and password works in the demo).
2. Wait about 6 seconds. **Drain 2** gets blocked and a notification appears.
3. Tap the notification. Drain 2 cleans itself (Detect → Lift → Drop → Return), then a second notification says it is clear again.
4. Go to **Alerts** to see where each alert happened. Tap **Mark as emptied** on Drain 1's basket.
5. Go to **Log** to see the new cycles.
6. Open any drain and tap **Run cleaning cycle** to start one by hand. Tap **Details** for the water-level chart.
7. To show the blockage again: **Settings → Demo → Play again**.

## Changing the sample data

Open `js/data.js`:

- `UNITS` – the drains, their locations ("Site A/B/C") and readings
- `DEMO_BLOCKAGE` – which drain gets blocked in the demo and after how many seconds
- `CYCLE_LOG` and `PAST_ALERTS` – the history shown in Log and Alerts

## Connecting the real units (next step)

Each ESP32 will send its readings (water level, water flow, ultrasonic distance, limit switch states, battery) over Wi-Fi. When that is ready, the sample values in `js/data.js` get replaced by the live readings, and the screens in `js/app.js` keep working the same way.
