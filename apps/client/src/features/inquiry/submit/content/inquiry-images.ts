// Open-licence pictures of the kinds of rooms PMCM plans in; none shows a PMCM event.
// Replace with PMCM's own photographs when they exist.

export interface InquiryImage {
  src: string;
  alt: string;
  credit: string;
  page: string;
}

export const inquiryImages = {
  ballroom: {
    src: "/inquiry/ballroom.jpg",
    alt: "A hotel ballroom set with round banquet tables and white chairs",
    credit: "\"Puri Bali Grand Ballroom at Paradisus by Meliá Bali\" by Paradisus Bali, CC BY-SA 4.0, via Wikimedia Commons",
    page: "https://commons.wikimedia.org/wiki/File:Puri_Bali_Grand_Ballroom_at_Paradisus_by_Meli%C3%A1_Bali.jpg",
  },
} satisfies Record<string, InquiryImage>;
