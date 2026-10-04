// Fragrance notes and a library of well-known perfumes for "Talk with SD".
// Notes follow each perfume's publicly listed pyramid, simplified to the names below.
// To add a perfume: copy a line in CATALOG and change the name, brand and notes.
window.SD_NOTES = (function () {
  // Notes offered as choices in the chat, grouped by where they usually sit in a perfume.
  const CHOICES = {
    top: [
      "Bergamot", "Lemon", "Mandarin", "Orange", "Grapefruit", "Lime", "Apple", "Pear", "Pineapple",
      "Blackcurrant", "Strawberry", "Pink Pepper", "Black Pepper", "Cardamom", "Saffron", "Lavender", "Mint", "Sea Notes",
    ],
    middle: [
      "Rose", "Jasmine", "Orange Blossom", "Tuberose", "Iris", "Violet", "Peony", "Lily of the Valley", "Ylang-Ylang",
      "Freesia", "Neroli", "Geranium", "Cinnamon", "Nutmeg", "Ginger", "Coffee", "Honey", "Sage",
    ],
    base: [
      "Vanilla", "Amber", "Musk", "Sandalwood", "Cedarwood", "Vetiver", "Patchouli", "Oud", "Tonka Bean",
      "Ambroxan", "Leather", "Tobacco", "Incense", "Oakmoss", "Praline", "Benzoin", "Cocoa",
    ],
  };

  // [name, brand, gender, top notes, heart notes, base notes]
  const RAW = [
    ["Sauvage EDT", "Dior", "Men", "Bergamot, Black Pepper", "Lavender, Geranium, Pink Pepper, Vetiver, Patchouli", "Ambroxan, Cedarwood, Labdanum"],
    ["Bleu de Chanel EDT", "Chanel", "Men", "Grapefruit, Lemon, Mint, Pink Pepper", "Ginger, Nutmeg, Jasmine", "Incense, Vetiver, Cedarwood, Sandalwood, Patchouli"],
    ["Acqua di Giò EDT", "Giorgio Armani", "Men", "Lime, Lemon, Bergamot, Mandarin, Neroli", "Sea Notes, Jasmine, Rosemary, Violet", "Musk, Cedarwood, Oakmoss, Patchouli, Amber"],
    ["Aventus", "Creed", "Men", "Pineapple, Bergamot, Blackcurrant, Apple", "Birch, Patchouli, Jasmine, Rose", "Musk, Oakmoss, Ambergris, Vanilla"],
    ["Dior Homme Intense", "Dior", "Men", "Lavender", "Iris, Ambrette, Pear", "Vetiver, Cedarwood"],
    ["Terre d'Hermès EDT", "Hermès", "Men", "Orange, Grapefruit", "Black Pepper, Geranium", "Vetiver, Cedarwood, Patchouli, Benzoin"],
    ["Allure Homme Sport", "Chanel", "Men", "Orange, Sea Notes, Mandarin", "Black Pepper, Neroli, Cedarwood", "Tonka Bean, Vanilla, Musk, Amber, Vetiver"],
    ["1 Million", "Paco Rabanne", "Men", "Mandarin, Grapefruit, Mint", "Rose, Cinnamon", "Leather, Amber, Patchouli"],
    ["Invictus", "Paco Rabanne", "Men", "Sea Notes, Grapefruit, Mandarin", "Bay Leaf, Jasmine", "Ambergris, Guaiac Wood, Oakmoss, Patchouli"],
    ["Eros EDT", "Versace", "Men", "Mint, Apple, Lemon", "Tonka Bean, Ambroxan, Geranium", "Vanilla, Cedarwood, Vetiver, Oakmoss"],
    ["Le Male EDT", "Jean Paul Gaultier", "Men", "Lavender, Mint, Cardamom, Bergamot", "Cinnamon, Orange Blossom", "Vanilla, Tonka Bean, Amber, Sandalwood, Cedarwood"],
    ["Ultra Male", "Jean Paul Gaultier", "Men", "Pear, Lavender, Mint, Bergamot, Lemon", "Cinnamon, Sage", "Vanilla, Amber, Patchouli, Cedarwood"],
    ["Luna Rossa Carbon", "Prada", "Men", "Bergamot, Black Pepper", "Lavender", "Ambroxan, Patchouli"],
    ["The One for Men EDP", "Dolce & Gabbana", "Men", "Grapefruit, Coriander, Basil", "Cardamom, Ginger, Orange Blossom", "Tobacco, Amber, Cedarwood"],
    ["Boss Bottled EDT", "Hugo Boss", "Men", "Apple, Plum, Lemon, Bergamot, Geranium", "Cinnamon, Carnation", "Vanilla, Sandalwood, Cedarwood, Vetiver"],
    ["Explorer", "Montblanc", "Men", "Bergamot, Pink Pepper, Sage", "Vetiver, Leather", "Ambroxan, Patchouli"],
    ["Layton", "Parfums de Marly", "Men", "Apple, Lavender, Bergamot, Mandarin", "Geranium, Violet, Jasmine", "Vanilla, Cardamom, Sandalwood, Black Pepper, Patchouli"],
    ["Oud for Greatness", "Initio", "Unisex", "Saffron, Nutmeg, Lavender", "Oud", "Patchouli, Musk"],
    ["Club de Nuit Intense Man", "Armaf", "Men", "Lemon, Pineapple, Bergamot, Blackcurrant, Apple", "Birch, Jasmine, Rose", "Musk, Ambergris, Patchouli, Vanilla"],
    ["Hawas for Him", "Rasasi", "Men", "Apple, Bergamot, Lemon, Cinnamon", "Plum, Orange Blossom, Cardamom", "Ambergris, Musk, Patchouli"],
    ["Asad", "Lattafa", "Men", "Black Pepper, Pineapple, Tobacco", "Coffee, Patchouli, Iris", "Amber, Vanilla, Benzoin, Labdanum"],
    ["Khamrah", "Lattafa", "Unisex", "Cinnamon, Nutmeg, Bergamot", "Dates, Praline, Tuberose", "Vanilla, Tonka Bean, Amber, Myrrh, Benzoin"],
    ["Amber Oud Gold Edition", "Al Haramain", "Unisex", "Bergamot, Green Notes", "Melon, Pineapple", "Amber, Vanilla, Musk"],
    ["Oud Wood", "Tom Ford", "Unisex", "Rosewood, Cardamom, Pink Pepper", "Oud, Sandalwood, Vetiver", "Tonka Bean, Vanilla, Amber"],
    ["Tobacco Vanille", "Tom Ford", "Unisex", "Tobacco, Spices", "Vanilla, Cocoa, Tonka Bean", "Dried Fruits, Woody Notes"],
    ["Black Orchid", "Tom Ford", "Women", "Truffle, Blackcurrant, Ylang-Ylang, Bergamot, Mandarin", "Orchid, Jasmine, Spices", "Cocoa, Patchouli, Vanilla, Incense, Sandalwood, Vetiver"],
    ["Lost Cherry", "Tom Ford", "Unisex", "Cherry, Bitter Almond", "Rose, Jasmine", "Peru Balsam, Tonka Bean, Sandalwood, Vetiver, Cedarwood"],
    ["Baccarat Rouge 540 EDP", "Maison Francis Kurkdjian", "Unisex", "Saffron, Jasmine", "Amber, Ambroxan", "Fir Resin, Cedarwood"],
    ["Santal 33", "Le Labo", "Unisex", "Cardamom, Violet", "Iris, Sandalwood", "Cedarwood, Leather, Ambroxan"],
    ["Gypsy Water", "Byredo", "Unisex", "Bergamot, Lemon, Black Pepper, Juniper", "Incense, Pine, Iris", "Amber, Vanilla, Sandalwood"],
    ["Wood Sage & Sea Salt", "Jo Malone", "Unisex", "Ambrette, Sea Notes", "Sea Salt, Sage", "Musk, Driftwood"],
    ["English Pear & Freesia", "Jo Malone", "Women", "Pear, Melon", "Freesia, Rose", "Musk, Patchouli, Amber"],
    ["Erba Pura", "Xerjoff", "Unisex", "Orange, Lemon, Bergamot", "Fruity Notes", "Musk, Vanilla, Amber"],
    ["By the Fireplace", "Maison Margiela", "Unisex", "Pink Pepper, Orange Blossom, Clove", "Chestnut, Guaiac Wood, Juniper", "Vanilla, Peru Balsam, Cashmeran"],
    ["Jazz Club", "Maison Margiela", "Men", "Pink Pepper, Neroli, Lemon", "Rum, Vetiver, Sage", "Tobacco, Vanilla, Styrax"],
    ["Intense Cafe", "Montale", "Unisex", "Coffee", "Rose", "Vanilla, Amber, Musk"],
    ["CK One", "Calvin Klein", "Unisex", "Lemon, Bergamot, Pineapple, Mandarin, Cardamom", "Lily of the Valley, Jasmine, Violet, Nutmeg, Rose", "Musk, Cedarwood, Sandalwood, Oakmoss, Amber"],
    ["Libre EDP", "Yves Saint Laurent", "Women", "Lavender, Mandarin, Blackcurrant", "Lavender, Orange Blossom, Jasmine", "Vanilla, Musk, Cedarwood, Ambergris"],
    ["Black Opium EDP", "Yves Saint Laurent", "Women", "Pear, Pink Pepper, Orange Blossom", "Coffee, Jasmine, Bitter Almond", "Vanilla, Patchouli, Cedarwood"],
    ["La Vie est Belle", "Lancôme", "Women", "Blackcurrant, Pear", "Iris, Jasmine, Orange Blossom", "Praline, Vanilla, Patchouli, Tonka Bean"],
    ["Coco Mademoiselle EDP", "Chanel", "Women", "Orange, Mandarin, Orange Blossom, Bergamot", "Mimosa, Jasmine, Rose, Ylang-Ylang", "Patchouli, Vanilla, Vetiver, Tonka Bean, Musk"],
    ["N°5 EDP", "Chanel", "Women", "Aldehydes, Ylang-Ylang, Neroli, Bergamot, Lemon", "Iris, Jasmine, Rose, Lily of the Valley", "Amber, Sandalwood, Musk, Oakmoss, Vanilla, Vetiver, Patchouli"],
    ["J'adore EDP", "Dior", "Women", "Pear, Melon, Magnolia, Mandarin, Bergamot", "Jasmine, Lily of the Valley, Tuberose, Freesia, Rose, Violet", "Musk, Vanilla, Cedarwood"],
    ["Miss Dior Blooming Bouquet", "Dior", "Women", "Mandarin", "Peony, Rose, Apricot, Peach", "Musk"],
    ["Flowerbomb", "Viktor & Rolf", "Women", "Tea, Bergamot, Osmanthus", "Orchid, Jasmine, Freesia, Rose", "Patchouli, Musk"],
    ["Good Girl", "Carolina Herrera", "Women", "Almond, Coffee, Lemon, Bergamot", "Tuberose, Jasmine, Orange Blossom, Rose, Iris", "Tonka Bean, Cocoa, Vanilla, Praline, Sandalwood, Musk, Amber, Cinnamon, Patchouli, Cedarwood"],
    ["Sì EDP", "Giorgio Armani", "Women", "Blackcurrant", "Rose, Freesia", "Vanilla, Patchouli, Ambroxan"],
    ["Donna Born in Roma", "Valentino", "Women", "Blackcurrant, Pink Pepper, Bergamot", "Jasmine", "Vanilla, Cashmeran, Guaiac Wood"],
    ["Delina", "Parfums de Marly", "Women", "Lychee, Rhubarb, Bergamot, Nutmeg", "Rose, Peony, Musk, Vanilla", "Cashmeran, Incense, Vetiver"],
    ["Angel EDP", "Mugler", "Women", "Melon, Coconut, Mandarin, Bergamot", "Honey, Apricot, Blackberry, Plum, Jasmine, Rose", "Tonka Bean, Patchouli, Cocoa, Caramel, Vanilla, Amber, Musk"],
    ["Alien EDP", "Mugler", "Women", "Jasmine", "Cashmeran", "Amber"],
    ["For Her EDT", "Narciso Rodriguez", "Women", "Orange Blossom, Osmanthus, Bergamot", "Musk, Amber", "Vanilla, Patchouli, Vetiver"],
    ["L'Interdit EDP", "Givenchy", "Women", "Pear, Bergamot", "Tuberose, Orange Blossom, Jasmine", "Patchouli, Vetiver, Ambroxan, Vanilla"],
    ["Chloé EDP", "Chloé", "Women", "Peony, Lychee, Freesia", "Rose, Magnolia, Lily of the Valley", "Cedarwood, Amber"],
    ["Daisy EDT", "Marc Jacobs", "Women", "Strawberry, Violet, Grapefruit", "Gardenia, Violet, Jasmine", "Musk, Vanilla, White Woods"],
    ["Her EDP", "Burberry", "Women", "Strawberry, Raspberry, Blackberry, Cherry, Blackcurrant, Mandarin, Lemon", "Violet, Jasmine", "Musk, Vanilla, Cashmeran, Amber, Oakmoss, Patchouli"],
    ["Light Blue", "Dolce & Gabbana", "Women", "Lemon, Apple, Cedarwood, Bellflower", "Bamboo, Jasmine, Rose", "Cedarwood, Musk, Amber"],
    ["Shalimar EDP", "Guerlain", "Women", "Bergamot, Lemon, Mandarin", "Iris, Jasmine, Rose", "Vanilla, Tonka Bean, Incense, Leather, Opoponax"],
    ["Cloud", "Ariana Grande", "Women", "Lavender, Pear, Bergamot", "Whipped Cream, Praline, Coconut, Vanilla", "Musk, Woody Notes"],
  ];

  const split = (s) => s.split(",").map((x) => x.trim()).filter(Boolean);
  const CATALOG = RAW.map(([name, brand, gender, top, middle, base]) => ({
    name, brand, gender, top: split(top), middle: split(middle), base: split(base),
  }));

  // Every note name we know, to tidy up what you type in admin ("bergamot" → "Bergamot").
  const KNOWN = new Map();
  [...CHOICES.top, ...CHOICES.middle, ...CHOICES.base, ...CATALOG.flatMap((p) => [...p.top, ...p.middle, ...p.base])]
    .forEach((n) => KNOWN.set(n.toLowerCase(), n));

  function tidy(note) {
    const t = String(note || "").trim();
    if (!t) return "";
    return KNOWN.get(t.toLowerCase()) || t.replace(/\b\w/g, (c) => c.toUpperCase());
  }

  return { CHOICES, CATALOG, tidy };
})();
