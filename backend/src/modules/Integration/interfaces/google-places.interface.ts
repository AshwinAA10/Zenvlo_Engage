export interface IGooglePlaceSearchResult {
  placeId: string;
  name: string;
  formattedAddress: string;
  rating?: number;
  userRatingsTotal?: number;
}

export interface IGoogleReview {
  externalId: string;
  authorName: string;
  authorPhotoUrl?: string;
  rating: number;
  text: string;
  reviewDate: Date;
  profileUrl?: string;
}

export interface IGooglePlaceDetails {
  placeId: string;
  name: string;
  formattedAddress: string;
  rating: number;
  userRatingsTotal: number;
  url?: string;
  website?: string;
  phoneNumber?: string;
  reviews: IGoogleReview[];
}

export interface IGooglePlacesService {
  SearchPlaces(query: string): Promise<IGooglePlaceSearchResult[]>;
  GetPlaceDetails(placeId: string): Promise<IGooglePlaceDetails>;
}

export const GOOGLE_PLACES_SERVICE = 'GOOGLE_PLACES_SERVICE';
