# Follow-up for the Rive agent: daylight scenes

The website is light throughout, and the tutor UI is now light too. The four scenes in `zai_scenes.riv`
are still painted as dusk and night (dark purple tea house, dark navy rooftop). They are the only dark
surfaces left on `/ai-tutor` and in the Practice Room.

The app now sets `SceneVM.timeOfDay = 15` (`DAYLIGHT_TIME_OF_DAY` in `src/lib/tutor/rive-driver.ts`).
Today that only lowers the `NightTint` overlay, because the base palettes themselves are dark.

## Ask

1. Make `timeOfDay` drive the base palette, not only a tint. 0–30 should read as bright daytime: a
   warm cream or soft sky, light walls, and the window showing a daytime view. 70 stays as today's dusk,
   and 100 as night.
2. Daytime targets per scene:
   - **Scene_TeaHouse:** cream walls (#FFF4E6 range), pale jade sky through the moon window, no moon at 0–30.
   - **Scene_Cafe:** warm terracotta wall lightened (#F6D7C3 range), sunny Seville sky in the arch.
   - **Scene_Rooftop:** pale blue Paris sky, light zinc roofs, white window frame.
   - **Scene_Clinic:** already light. Keep it, but make it brighter and less grey.
3. Keep the teacher readable: there should be enough contrast between the character's outline and the
   lighter background (a soft rim or shadow behind her is fine).
4. No contract change is needed: `timeOfDay` already exists (0–100). Bump the file, not the contract version.
5. Update `design/rive/previews/scenes_*.png` with the 15 and 70 states, and re-run `npm run test:rive`.
