---
title: Interactive Globe: How Much Warmer Is Each Part of the World Than 1880-1900?
subtitle: Spin the globe, pick a month, and play every year since 1880. See where the 1.5°C line is crossed, how much land and how many people sit above it, and exactly how we built it.
slug: climate-globe
date: 2026-09-12
section: Visualization
hero: images/climate-globe-hero-1680x1080.png
hero_alt:
meta_title: Global Warming Map: Temperature vs. 1880-1900, by Month
description: Interactive 3D globe of monthly temperature change since 1880, with the share of land and people above 1.5°C. NASA GISTEMP data, fully documented.
keywords: global temperature anomaly map, 1.5 degrees Celsius, pre-industrial baseline, NASA GISTEMP, climate change map, interactive globe, August 2026 temperature, global warming by region
schema_type: dataset
drop_cap: false
heading_spacer: 20px
caption_spacer: 20px
dividers: true
---

# Interactive Globe: How Much Warmer Is Each Part of the World Than 1880-1900?

<iframe src="https://data4thepeople.github.io/ClimateGlobe/dist/index.html#embed=1" width="100%" height="780" loading="lazy" style="border:0" title="Interactive globe: how much warmer than 1880-1900"></iframe>## Purpose

This visualization answers one question at a glance: how much warmer is each part of the world than it was before industrial warming began, and where has that change passed 1.5°C?

The 1.5°C figure comes from the Paris Agreement, where countries agreed to try to hold global warming to 1.5°C above the pre-industrial level. That target is a global average over decades. But warming is not spread evenly. Land warms faster than oceans, the Arctic warms faster than the tropics, and a single month can run hot in one region and cold in another. A global average hides all of that.

The globe above shows the local picture. Every point on Earth is colored by how much warmer or cooler a given month was than the same month in 1880-1900, the earliest period in NASA's record and the period NASA uses to stand in for "pre-industrial." Two of the numbers beside the globe sum it up: the share of the world's land area that was more than 1.5°C above its baseline, and the share of today's population living in those places.

Pick a month, then press play. The globe runs through every year of that month since 1880, so you can watch the warm areas grow, shrink, and grow again over 147 years.

## Using the globe

Drag to spin it. Hover for the value at any point. The chart under the numbers tracks the two shares across every year of the chosen month.

The tool is free to use and free to embed. It is also available as a full page at [data4thepeople.github.io/ClimateGlobe](https://data4thepeople.github.io/ClimateGlobe/dist/index.html), where you can link straight to a view: add #month=3&year=1998 to the end of the address to open March 1998, hot=1 to highlight only the areas above 1.5°C, and avg=1 for the 10-year average.

### How to read it

- **Color** runs from blue (cooler than 1880-1900) through white (no change) to red (warmer). Pale red means warmer but still under 1.5°C. The red darkens past 1.5°C and reaches its deepest shade at 6°C. The legend marks the 1.5°C point.
- **Highlight only areas above 1.5°C** turns everything at or below the line gray, so the areas past it stand out.
- **10-year average of this month** replaces the single month with the average of the last ten of that month. This is the better match for how the 1.5°C target is defined, and it is much less jumpy.
- **Gray patches** are places where NASA reports no value for that month. Early years have many. The note above the legend says how much of the land and population had data.
- **The three numbers** are the global average change, the share of land area above 1.5°C, and the share of today's population living where it is above 1.5°C. All three follow the month, year, and average setting you choose.

### What it shows right now

As of NASA's September 2026 release, the latest month is August 2026. Against the same month in 1880-1900:

- The global average was 1.60°C warmer.
- 77% of the world's land area was more than 1.5°C warmer.
- 73% of today's population lives in places that were more than 1.5°C warmer.

Those are single-month readings, and single months swing. The 10-year average of Augusts from 2017 through 2026 comes in at 1.22°C, with 60% of land and 54% of people above 1.5°C. For comparison, August 1998, a record at the time thanks to a strong El Niño (the Pacific Ocean warming pattern that lifts global temperatures), had 38% of land and 23% of people above the line.

The chart under the globe makes the swing visible. In the 1880s and 1890s, before there was any trend to speak of, a warm winter over Siberia or Canada could put 20% or 30% of land above 1.5°C for a single January. What has changed is not that hot months exist. It is that the floor has risen until most months, in most places, sit above the line.

## What this page is

Every chart we publish should be something you can check, question, and rebuild yourself. This page documents how we built the globe: where the data comes from, every transformation we applied, and the judgment calls we made along the way. Nothing here is proprietary. The code and the built files are in a public repository, linked at the end.

## The data sources

Three public datasets go into the globe. We do not alter any of the underlying figures. Our work is moving the baseline, adding up land and people, and drawing the globe.

**Temperature: NASA GISTEMP v4.** The NASA Goddard Institute for Space Studies publishes the GISS Surface Temperature Analysis, a monthly map of temperature change covering the world since January 1880. NASA divides the world into cells 2° of latitude by 2° of longitude, about 220 km on a side at the equator. Each cell's value blends every weather station within 1,200 km with ship and buoy readings of sea surface temperature. (NASA's names for those two inputs are GHCN v4 and ERSST v5.) Each cell holds one value per month: how far that month's temperature departed from that cell's normal for the same calendar month. NASA measures "normal" from 1951-1980; we move it back to 1880-1900 in Step 2, so nothing on the globe is compared with 1951-1980. The file is free, needs no login, and is updated around the middle of each month with the prior month's data.

**Population: GHS-POP 2025.** The European Commission's Joint Research Centre publishes the Global Human Settlement Layer, a population grid built from census data and satellite imagery. We use the 2025 estimate, which counts people in squares about one kilometer on a side. It sums to 8.19 billion people.

**Coastlines, borders, and land: Natural Earth.** The coastline, country border, and land outline files at Natural Earth's coarsest level of detail, meant for whole-world maps. They are in the public domain.

## How we built it

### Step 1: Start with what NASA already gives you

NASA's file is a stack of 1,760 monthly maps, January 1880 through August 2026, each one 90 rows of latitude by 180 columns of longitude. Every cell holds a change, not a temperature: how far that month sat above or below the cell's 1951-1980 average for that calendar month. NASA chose 1951-1980 as its reference decades ago and has kept it for continuity. Nothing about our result depends on that choice, as the next step shows.

### Step 2: Move the baseline back to 1880-1900

The 1.5°C target is measured from the pre-industrial period, which the Intergovernmental Panel on Climate Change (IPCC) defines as 1850-1900. NASA's record starts in 1880, so we use 1880-1900. For the globe as a whole, the two periods differ by a few hundredths of a degree.

Here is how it works for one place. NASA says the Augusts of 1880 through 1900 in the cell that covers Paris averaged 0.44°C below that cell's normal. We call that the cell's August baseline. NASA says August 2026 in the same cell was 3.91°C above normal. The globe shows the gap between those two: 3.91 minus negative 0.44, or 4.35°C. That is how much warmer August 2026 was in Paris than the average August of 1880-1900.

Notice that "normal" never had to be defined. Both numbers were measured from the same normal (1951-1980), so it drops out of the subtraction. Whatever period NASA had chosen, the answer would be 4.35°C.

We do this for every cell and every calendar month separately: 16,200 cells, twelve months each, 21 baseline years averaged for each one. August is always compared with August and January with January, because a normal August and a normal January are very different things.

The shift is not uniform. For the globe as a whole, 1880-1900 Augusts were about 0.18°C cooler than 1951-1980 Augusts. Over Europe the gap is 0.36°C, and over parts of the Arctic it is larger still. Some published series convert to pre-industrial by adding one worldwide number to every location. That would miss those differences. A cell-by-cell baseline keeps them.

### Step 3: Borrow a baseline where 1880-1900 has no data

In 1880 there were no weather stations in Antarctica, few in the interior of Africa, South America, or Asia, and none in the Arctic Ocean. NASA's grid leaves those cells empty for the early years. A cell needs at least ten of the 21 baseline years to get its own baseline. That rules out 27% of cells: Antarctica, the Amazon basin, central Africa, the Sahara and Arabia, the deserts of western China, the Arctic coasts, and much of the Southern Ocean.

For those cells we borrow. The baseline becomes the average baseline of the cells the same distance from the equator that do have data, the ring of cells around the Earth at that latitude. If an entire ring has none, we use the nearest ring that does.

Take the cell that covers Kinshasa, in central Africa. Only 6 of the 21 Augusts from 1880 to 1900 have a value there, not enough for a baseline of its own. The ring of cells at that latitude, 5° south of the equator, has 147 cells that do have one, and their August baselines average 0.14°C below normal. Kinshasa borrows that. NASA puts August 2026 there at 1.49°C above normal, so the globe shows 1.49 minus negative 0.14, or 1.63°C above 1880-1900.

The South Pole is the extreme case. No cell south of 65°S has any 1880-1900 data at all, so the whole of Antarctica borrows from the ring at 65°S, a shift of 0.52°C. NASA's August 2026 value at the pole is 0.47°C below normal, which the globe shows as 0.99°C below 1880-1900.

In each case the effect is one flat shift applied to NASA's values across the region. The pattern you see there is NASA's. The level is approximate. The footnote on the globe says which regions this affects, and the "Honest notes" section below says what it does to the headline numbers.

### Step 4: Share of land above 1.5°C

Each of the 16,200 cells gets a land fraction, computed by laying a fine grid of squares, a tenth of a degree on a side, over the Natural Earth land outlines, marking each square land or water, and averaging the 400 squares inside each 2° cell. Cells near the poles are physically much smaller than cells at the equator, so each cell is also weighted by its true area on the sphere.

The land share is then the land area inside cells above 1.5°C, divided by the land area inside every cell that has a value that month. Cells with no value are left out of both the top and the bottom of that fraction, which is why the coverage note matters in early years. Antarctica counts as land. It is 8% of the world's land area.

### Step 5: Share of people above 1.5°C

The population grid has more than 900 million cells. We sum them into the 16,200 temperature cells, so each 2° cell knows how many people live in it. The population share is the sum of people in cells above 1.5°C, divided by the sum of people in every cell with a value that month.

We hold the 2025 population fixed for every year. The number therefore reads as "the share of today's people who live where that month was above 1.5°C," not the share of the people alive at the time. Population in 1900 was about a fifth of what it is now and lived in different places, so a time-varying version would answer a different and murkier question.

### Step 6: The 10-year average

For any month and year, the 10-year view averages the ten most recent instances of that month, so August 2026 becomes the average of Augusts 2017 through 2026. A cell needs at least seven of the ten to get a value; the first years of the record show nothing until enough have accumulated. The land and population shares are recomputed from the averaged map, not averaged from the single-month shares, which matters: the average of ten maps can sit under 1.5°C in a place where several single months were over it.

### Step 7: The color scale

The scale runs in two directions from a center of zero: reds for warmer, blues for cooler. From zero to 1.5°C it runs from near-white through pale red to a mid red. Past 1.5°C it continues to darken, reaching the deepest red at 6°C, where it stops. Blues mirror the reds on the cool side. Values beyond plus or minus 6°C, which happen in the Arctic and Antarctic in single months, take the end color. Ten-year averages rarely reach the ends of the scale; single months in polar regions often do.

Color values are stored at a tenth of a degree, which is enough for the eye. All three headline numbers are computed from the exact values, not the rounded ones.

### Step 8: Drawing the globe

The globe is drawn by your device's graphics chip, using code we wrote rather than an off-the-shelf mapping tool. For every pixel on the screen, the page works out which point on a sphere it is looking at, converts that to latitude and longitude, and blends the four surrounding cells so the coloring is continuous rather than blocky. Coastlines and borders are drawn once onto a flat map image and wrapped around the same sphere. Dragging changes the rotation; nothing else is recomputed.

Each calendar month's 147 years of maps ship as one compressed file of under a megabyte. August is built into the page. The other eleven months download the first time you select them.

## Updating

NASA publishes the previous month's data around the middle of each month. Updating the globe is three commands: fetch the new NASA file, recompute the baselines and shares, and rebuild the page. Every number on the globe and on this page comes from that pipeline, with nothing typed in by hand. We plan to refresh it monthly.

## Honest notes and limitations

We would rather tell you the edges of this than have you find them.

**1880-1900 is not 1850-1900.** The IPCC's pre-industrial period starts thirty years earlier than NASA's record. Globally the difference is small. Regionally it can matter: the 1880s and 1890s were a cold stretch in Europe compared with the decades before, so European changes measured from 1880-1900 run about 0.2 to 0.3°C higher than the figures that Copernicus, the European Union's climate service, and the European Environment Agency publish against 1850-1900. When you quote a number from this globe, say "vs. 1880-1900."

**A single month is noisy.** The 1.5°C target is a twenty-year global average. One August in one place is neither. The single-month view is there because the swings are the point; the 10-year average is there because it is closer to what the target means. Both are labeled.

**Borrowed baselines cover a quarter of the land and a tenth of the people.** For Antarctica, the tropical interiors, the deserts of western China, and the Arctic coasts, the baseline is borrowed from the ring of cells at the same latitude (Step 3). Those cells hold 27% of the world's land area and 11% of today's population. Recomputing the August 2026 shares using only cells with their own baseline moves the land figure from 77% to 74% and the population figure from 73% to 72%. For the 10-year average the land figure moves from 60% to 63%. The headline numbers are not sensitive to it, but the map in those regions is a pattern with an uncertain level.

**The grid is coarse.** Two degrees is about 220 km at the equator, and NASA's 1,200 km smoothing spreads each station's influence further. The globe cannot show a city, a mountain range, or the local climate of a stretch of coast. Within about 800 km of the South Pole, NASA's grid carries a single value from the one station there, which is why the pole shows as a flat disk.

**Population is today's.** See Step 5. The population share for 1900 is about where people live now, not then.

**The latest month has holes.** Station reports arrive late. In the September 2026 release, 22 cells over Zambia, Zimbabwe, and Botswana had no August value even though every August from 2015 to 2025 does. NASA usually fills these in a later release, and the globe will pick that up on the next refresh.

**Antarctica is in the land share.** It is 8% of the world's land area, has almost no permanent population, and swings by several degrees from one month to the next. It is land, so it is counted. Leaving it out would move the August 2026 land figure from 77% to 78%.

**Sea ice is blank.** NASA does not report a value over sea ice. The gray wedges around Antarctica and in the Arctic Ocean are that, not an error.

**We did not invent the data.** Every temperature change is NASA's and every population count is the Joint Research Centre's. Our contribution is the shift of the baseline to 1880-1900, the land and population sums, the 10-year average, the color scale, and the interactivity.

## Reproduce it yourself

The code, the build steps, and the published files are at [github.com/Data4ThePeople/ClimateGlobe](https://github.com/Data4ThePeople/ClimateGlobe). You need NASA's GISTEMP grid file, the GHS-POP 2025 population grid, the three Natural Earth files, and Python. The transformations are the eight steps above; the statistics are averages and weighted sums. If you do it and get something different from us, we want to know. Tell us, and we will look.

## Common questions

### What does 1.5°C above pre-industrial mean?

It means the global average surface temperature, averaged over many years, is 1.5°C warmer than it was in 1850-1900, before fossil fuel use changed the atmosphere. The Paris Agreement set 1.5°C as the level countries would try to stay under. This globe shows the same measure for each place on Earth, month by month, against 1880-1900.

### Has the world already passed 1.5°C?

Single years have. Copernicus reported 2024 as the first calendar year above 1.5°C, and August 2026 at 1.65°C against 1850-1900. The target refers to a long-term average, and by that measure the world was close to but not yet at 1.5°C as of 2026. On this globe, the 10-year average of Augusts from 2017 to 2026 is 1.22°C against 1880-1900.

### Why does the map use 1880-1900 instead of 1850-1900?

Because NASA's record begins in 1880. For the globe as a whole the two periods are within a few hundredths of a degree of each other. Regionally they can differ by a few tenths, which is why we label every number "vs. 1880-1900."

### Why are some areas gray?

NASA reports no value there for that month. In early years that is most of the Southern Hemisphere and the polar regions. In recent months it is sea ice and a handful of cells where station reports arrived late.

### Why does a single month look so different from the 10-year average?

Weather. One month at one place can run several degrees above or below normal, and the Arctic and Antarctic can swing by more than 6°C. Averaging ten of the same month smooths most of that out and leaves the trend.

### Where does the population data come from?

The Global Human Settlement Layer from the European Commission's Joint Research Centre, 2025 estimate, at roughly one-kilometer resolution. We sum it into the 2° temperature cells and hold it fixed for every year.

### How often is the globe updated?

Monthly, after NASA's release, which usually lands in the middle of the following month.
