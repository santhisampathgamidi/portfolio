"""Bundled demo corpus.

A short, self-contained passage about the solar system. Deliberately picked
because each sentence is about a distinct entity (Sun, Mercury, Venus, ...),
so cosine-similarity scores tell an obvious story when users query things
like "what is the largest planet" or "which planet is hottest".
"""

DEMO_TEXT = """\
The Sun is the star at the center of the Solar System. It is a nearly perfect ball of hot plasma, with internal convective motion that generates a magnetic field. The Sun's diameter is about 1.39 million kilometers, roughly 109 times that of Earth, and its mass accounts for about 99.86 percent of the total mass of the Solar System.

Mercury is the smallest planet in the Solar System and the closest to the Sun. Its orbit takes only 88 Earth days to complete. Mercury has no atmosphere to retain heat, so its surface temperatures swing dramatically, from about 430 degrees Celsius during the day to minus 180 degrees Celsius at night.

Venus is the second planet from the Sun and the hottest planet in the Solar System, with surface temperatures reaching about 465 degrees Celsius. This extreme heat is caused by a runaway greenhouse effect from its thick atmosphere of carbon dioxide. Venus rotates very slowly and in the opposite direction to most other planets.

Earth is the third planet from the Sun and the only astronomical object known to harbor life. About 71 percent of Earth's surface is covered with water. Earth has one natural satellite, the Moon, which is the fifth largest moon in the Solar System and stabilizes the planet's axial tilt.

Mars is the fourth planet from the Sun and is often called the Red Planet because of the reddish iron oxide on its surface. Mars has the largest volcano in the Solar System, Olympus Mons, which stands about 22 kilometers tall. A Martian day is just slightly longer than an Earth day, at about 24 hours and 39 minutes.

Jupiter is the largest planet in the Solar System, more than twice as massive as all the other planets combined. It is a gas giant composed mainly of hydrogen and helium. Jupiter's most famous feature is the Great Red Spot, a giant storm that has raged for at least 350 years.

Saturn is the sixth planet from the Sun and is best known for its prominent ring system, made mostly of ice particles with a smaller amount of rocky debris and dust. Saturn is the second largest planet but has the lowest density of any planet in the Solar System; it would float in water if a large enough ocean existed.

Uranus is the seventh planet from the Sun. It is unique among the planets because it rotates on its side, with an axial tilt of about 98 degrees. Uranus has a pale blue color caused by methane in its atmosphere absorbing red light.

Neptune is the eighth and farthest known planet from the Sun. It has the strongest winds of any planet, reaching speeds of over 2,000 kilometers per hour. Neptune was the first planet to be discovered through mathematical prediction rather than direct observation.

Pluto, once considered the ninth planet, was reclassified as a dwarf planet in 2006 by the International Astronomical Union. Pluto is part of the Kuiper Belt, a region of icy bodies beyond Neptune. It has five known moons, the largest of which, Charon, is so big relative to Pluto that the two are sometimes considered a binary system.
"""

DEMO_QUERIES = [
    "What is the largest planet?",
    "Which planet is the hottest?",
    "Tell me about the rings of Saturn.",
    "Which planet rotates on its side?",
    "Why is Pluto not a planet anymore?",
]
