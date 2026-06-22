# Fact audit notes

This file tracks external checks that affect the app's biblical geography data.

## Current source baseline

- `public/data/openbible-places.json` is generated from OpenBible.info Bible Geocoding Data commit `7eb18a5ee62f27b9b93bd6689ea272d76dd23b8f`.
- The generated v1 snapshot includes all coordinate-backed ancient places: 1,309 resolved records from 1,342 ancient records, with 33 unresolved records counted in metadata.
- The app uses OpenBible's modern identifications, verse lists, source/vote signals, linked data, and confidence scores as the canonical place-data baseline.
- The generated app data excludes thumbnails, raw KML/GeoJSON geometry, OSM-derived polygons/paths, and images in this version.
- Attribution and license: OpenBible.info Bible Geocoding Data, CC BY 4.0.

## Historical prototype baseline

- OpenBible.info Bible Geocoding is used for biblical place references, possible identifications, confidence levels, and coordinate checks. It aggregates atlas/dictionary sources and links each place to verse lists and modern identifications.
- UNESCO World Heritage pages are used as independent checks for official heritage-site descriptions and geography, including Saint Catherine/Sinai, Ancient Jericho/Tell es-Sultan, Biblical Tels/Beer Sheba, Tyre, Damascus, Babylon, Susa, and Ephesus.
- Public-domain KJV JSON from `thiagobodruk/bible` is used for bulk scripture reference existence checks.
- Bible API's World English Bible output is used for targeted passage checks and fallback validation where the KJV JSON source has a verse-numbering gap.

## 2026-06-13 pass

- Cana: moved the marker from Kafr Kanna to Horbat Qana/Khirbet Qana (`32.8222, 35.30269`) because OpenBible gives Horbat Qana the stronger current identification and Kafr Kanna a low-confidence/traditional identification.
- Gaza: added Old Testament context from Judges and made the marker follow Tell Harube/Tell Azza (`31.504, 34.4644`), while keeping the Acts 8 road episode distinct from the city itself.
- Joppa: changed the region from the Philistine coast to the Mediterranean coast/Jaffa, and added Joshua/Chronicles context because Joppa is not only an Acts/Jonah site.
- Sinai: changed the geography copy to identify the marker as the traditional Jebel Musa/Horeb site and explicitly mark the exact biblical location as disputed.
- Samaria: changed the copy to distinguish the ancient city at Sebaste from broader New Testament regional uses.
- Ur: kept Tell el-Muqayyar as the marker, but changed the copy to avoid implying that Abraham's Ur has no alternate proposals.
- Egypt and Galilee: changed copy to make clear that the markers represent regions rather than precise single-city locations.
- Sinai references: replaced `3 Mos 1:1` with `3 Mos 7:38; 25:1; 26:46; 27:34` because these verses explicitly locate the Leviticus commands at Mount Sinai / Sinai.
- Bethany references: removed `Luk 10:38-42` because Luke names only "a certain village"; Luke 19/24, John 11/12, and Mark 11/14 directly name Bethany and remain.
- Current scripture verifier result after the geography/reference refinements: 32 locations, 85 reference objects, 3,520 resolved KJV verse/chapter chunks, 0 character-support misses, and 0 place-alias misses. The added references are backed by OpenBible verse lists for Haran, Bethany, Galilee, Pisgah/Nebo, Babylon, Cyprus/Kittim, and Ephesus. `Matt 2:23` is the only KJV JSON gap and was verified through Bible API.
- Hebron, Beer Sheva, Bethel, Shechem, Bethany, Bethlehem, and Nazareth: tightened marker coordinates against OpenBible's modern identifications, using caveats where the biblical place and the visible/traditional modern site are not identical.
- Hebron: removed `1 Mos 18:1` from the displayed references because OpenBible treats Mamre as a separate site and the verse itself does not name Hebron.
- Shechem/Sychar: kept John 4 as nearby regional context, but changed the geography note to identify Sychar/Jacob's well separately from the Tell Balata marker.
- Harran: added the Genesis 27-29 references around Rebekah, Jacob, and Laban so the character list is supported by displayed passages.
- Mount Nebo: renamed the marker to "Berget Nebo" and tied the geography to Pisgah/Rujm Siyaghah/Jabal Nebo instead of the separate biblical town of Nebo.
- Galilee: added representative Old Testament references and filters because OpenBible lists Galilee in Joshua/Kings/Isaiah as well as the Gospels; broadened the region label so the entry reads as a regional marker rather than a Kafarnaum-specific point.
- Carmel: clarified that the marker represents the ridge, because 1 Kings identifies Mount Carmel without giving a precise point on the ridge.
- Caesarea: clarified that the marker is Caesarea Maritima, not Caesarea Philippi.
- Babylon: added Ezekiel 1:1-3 because the data listed Ezekiel as a character; the geography now distinguishes the Babylon city marker from broader Babylonian/Chaldean exile references.
- Ephesus: clarified the ancient harbor setting and modern inland ruins using UNESCO's Ephesus description.
- Jericho: tightened the marker to Tell es Sultan for Old Testament Jericho and added a caveat that the Luke 18-19 New Testament Jericho material is associated with Tell el Alayiq in the same oasis area.
- Jerusalem, Capernaum, Tyre, Damascus, Antioch, Tarsus, and Nineveh: tightened marker coordinates against OpenBible's modern-location pages and clarified the underlying identification where the place is a visible ruin, historic core, or former island.
- Cyprus: added the prophetic Kittim/Cyprus references from Isaiah, Jeremiah, and Ezekiel so the Old Testament mentions are represented alongside the Acts mission route.
- Perge and Susa: clarified that the markers follow the ancient Perga/Perge ruins and Shush/Susa identification.
- Character-support pass: expanded Harran, Ephesus, and Susa references so Rebekah, Priscilla/Aquila/Apollos, and Daniel are supported by displayed passages; removed Matthew from Capernaum and Barnabas from Perge where the place-specific displayed passages did not directly name them.
- Consistency pass: updated `primaryBooks` for Galilee, Joppa, and Cyprus so every displayed reference book appears in the detail chips and book filters; added the `exodus` era to Galilee and Joppa because their displayed Joshua references belong to the same conquest/allotment category used elsewhere.
- Independent UNESCO cross-check: Jericho, Beer Sheva, Tyre, Damascus, Babylon, Susa, and Ephesus were checked against UNESCO heritage pages. This confirmed the main marker choices and led to tighter wording for Tell es-Sultan's location, Tyre as a former island/promontory, Babylon south of Baghdad by the Euphrates, and Susa in Susiana between Mesopotamia and the Iranian plateau.

## Source URLs

- https://www.openbible.info/geo/
- https://www.openbible.info/geo/ancient/a031bda/cana
- https://www.openbible.info/geo/modern/m7c7d60/horbat-qana
- https://www.openbible.info/geo/modern/ma43757/kefr-kenna
- https://www.openbible.info/geo/ancient/aa8edd2/gaza
- https://www.openbible.info/geo/modern/mb5cfe4/tell-harube
- https://www.openbible.info/geo/ancient/ae023a9/joppa
- https://www.openbible.info/geo/ancient/a041bb3/samaria-1
- https://www.openbible.info/geo/ancient/a6cf75c/ur-1
- https://www.openbible.info/geo/modern/m297af3/tell-el-muqayyar
- https://www.openbible.info/geo/ancient/a6d9af3/haran
- https://www.openbible.info/geo/ancient/af301ca/egypt
- https://www.openbible.info/geo/ancient/a85151a/hebron
- https://www.openbible.info/geo/ancient/ad2f6c2/beersheba-1
- https://www.openbible.info/geo/ancient/a075d61/beersheba-2
- https://www.openbible.info/geo/ancient/a64f355/bethel-1
- https://www.openbible.info/geo/ancient/adf74d4/shechem
- https://www.openbible.info/geo/ancient/a27b472/sychar
- https://www.openbible.info/geo/ancient/a4f35bc/bethany-1
- https://www.openbible.info/geo/ancient/a112427/bethlehem-1
- https://www.openbible.info/geo/ancient/af5884f/nazareth
- https://www.openbible.info/geo/ancient/afd9259/pisgah
- https://www.openbible.info/geo/ancient/a9cf1e8/galilee-1
- https://www.openbible.info/geo/ancient/a3e21c6/mount-carmel
- https://www.openbible.info/geo/ancient/a58735e/caesarea
- https://www.openbible.info/geo/ancient/a217d18/babylon-1
- https://www.openbible.info/geo/ancient/a69c1d4/damascus
- https://www.openbible.info/geo/ancient/a033b84/susa
- https://www.openbible.info/geo/ancient/a231f80/jericho-1
- https://www.openbible.info/geo/ancient/aaf03fa/jericho-2
- https://www.openbible.info/geo/modern/m95349d/tell-es-sultan
- https://www.openbible.info/geo/modern/mdf4652/tell-el-alayiq
- https://www.openbible.info/geo/ancient/a15257a/jerusalem
- https://www.openbible.info/geo/modern/m66c5b8/jerusalem
- https://www.openbible.info/geo/ancient/af2161c/capernaum
- https://www.openbible.info/geo/modern/m66efd0/tell-hum
- https://www.openbible.info/geo/ancient/a160272/tyre
- https://www.openbible.info/geo/modern/m11c602/tyre
- https://www.openbible.info/geo/modern/m878978/damascus
- https://www.openbible.info/geo/ancient/ae41ab4/antioch-1
- https://www.openbible.info/geo/modern/mbe432b/antioch-on-the-orontes
- https://www.openbible.info/geo/ancient/a2e7601/cyprus
- https://www.openbible.info/geo/ancient/a666ea0/tarsus
- https://www.openbible.info/geo/modern/mc9df1a/tarsus
- https://www.openbible.info/geo/ancient/aff04b8/perga
- https://www.openbible.info/geo/ancient/a5feb15/ephesus
- https://www.openbible.info/geo/ancient/a70fd5d/nineveh
- https://www.openbible.info/geo/modern/m52bd87/nineveh
- https://whc.unesco.org/en/list/1687/
- https://whc.unesco.org/en/list/1108/
- https://whc.unesco.org/en/list/299/
- https://whc.unesco.org/en/list/20/
- https://whc.unesco.org/en/list/278/
- https://whc.unesco.org/en/list/1455/
- https://international.visitjordan.com/wheretogo/mount-nebo/
- https://whc.unesco.org/en/list/954/
- https://whc.unesco.org/en/list/1018/
- https://raw.githubusercontent.com/thiagobodruk/bible/master/json/en_kjv.json
- https://bible-api.com/
