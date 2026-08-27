"use client";

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import type { Place, NewsArticle, VideoItem, MapPlace, ImageItem } from "./NawabActionsProvider";

/* ── Types ─────────────────────────────────────────────── */

export type TabType = "answer" | "places" | "news" | "videos" | "maps" | "images";

interface TabsState {
  places: Place[];
  news: NewsArticle[];
  videos: VideoItem[];
  maps: MapPlace[];
  images: ImageItem[];
  activeTab: TabType;
}

interface TabsContextValue {
  tabs: TabsState;
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  addPlaces: (places: Place[]) => void;
  addNews: (articles: NewsArticle[]) => void;
  addVideos: (videos: VideoItem[]) => void;
  addMaps: (places: MapPlace[]) => void;
  addImages: (images: ImageItem[]) => void;
  availableTabs: TabType[];
}

const EMPTY: TabsState = {
  places: [],
  news: [],
  videos: [],
  maps: [],
  images: [],
  activeTab: "answer",
};

const TabsContext = createContext<TabsContextValue | null>(null);

/* ── Data-collector helpers (call context from inside renders) ── */

export function PlacesCollector({ places }: { places: Place[] }) {
  const { addPlaces } = useResponseTabs();
  useEffect(() => {
    if (places.length > 0) addPlaces(places);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

export function NewsCollector({ articles }: { articles: NewsArticle[] }) {
  const { addNews } = useResponseTabs();
  useEffect(() => {
    if (articles.length > 0) addNews(articles);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

export function VideosCollector({ videos }: { videos: VideoItem[] }) {
  const { addVideos } = useResponseTabs();
  useEffect(() => {
    if (videos.length > 0) addVideos(videos);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

export function MapsCollector({ places }: { places: MapPlace[] }) {
  const { addMaps } = useResponseTabs();
  useEffect(() => {
    if (places.length > 0) addMaps(places);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

export function ImagesCollector({ images }: { images: ImageItem[] }) {
  const { addImages } = useResponseTabs();
  useEffect(() => {
    if (images.length > 0) addImages(images);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

/* ── Provider ───────────────────────────────────────────── */

export function ResponseTabsProvider({ children }: { children: ReactNode }) {
  const [tabs, setTabs] = useState<TabsState>(EMPTY);

  const setActiveTab = useCallback((tab: TabType) => {
    setTabs(prev => ({ ...prev, activeTab: tab }));
  }, []);

  const addPlaces = useCallback((places: Place[]) => {
    setTabs(prev => {
      const seen = new Set(prev.places.map(p => p.name));
      const fresh = places.filter(p => !seen.has(p.name));
      return fresh.length ? { ...prev, places: [...prev.places, ...fresh] } : prev;
    });
  }, []);

  const addNews = useCallback((articles: NewsArticle[]) => {
    setTabs(prev => {
      const seen = new Set(prev.news.map(a => a.link ?? a.headline));
      const fresh = articles.filter(a => !seen.has(a.link ?? a.headline));
      return fresh.length ? { ...prev, news: [...prev.news, ...fresh] } : prev;
    });
  }, []);

  const addVideos = useCallback((videos: VideoItem[]) => {
    setTabs(prev => {
      const seen = new Set(prev.videos.map(v => v.link ?? v.title));
      const fresh = videos.filter(v => !seen.has(v.link ?? v.title));
      return fresh.length ? { ...prev, videos: [...prev.videos, ...fresh] } : prev;
    });
  }, []);

  const addMaps = useCallback((places: MapPlace[]) => {
    setTabs(prev => {
      const seen = new Set(prev.maps.map(p => p.name));
      const fresh = places.filter(p => !seen.has(p.name));
      return fresh.length ? { ...prev, maps: [...prev.maps, ...fresh] } : prev;
    });
  }, []);

  const addImages = useCallback((images: ImageItem[]) => {
    setTabs(prev => {
      const seen = new Set(prev.images.map(img => img.imageUrl));
      const fresh = images.filter(img => !seen.has(img.imageUrl));
      return fresh.length ? { ...prev, images: [...prev.images, ...fresh] } : prev;
    });
  }, []);

  const availableTabs: TabType[] = [
    "answer",
    ...(tabs.places.length > 0 ? (["places"] as TabType[]) : []),
    ...(tabs.news.length > 0   ? (["news"]   as TabType[]) : []),
    ...(tabs.videos.length > 0 ? (["videos"] as TabType[]) : []),
    ...(tabs.maps.length > 0   ? (["maps"]   as TabType[]) : []),
    ...(tabs.images.length > 0 ? (["images"] as TabType[]) : []),
  ];

  return (
    <TabsContext.Provider value={{
      tabs,
      activeTab: tabs.activeTab,
      setActiveTab,
      addPlaces,
      addNews,
      addVideos,
      addMaps,
      addImages,
      availableTabs,
    }}>
      {children}
    </TabsContext.Provider>
  );
}

/* ── Hook ───────────────────────────────────────────────── */

export function useResponseTabs() {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error("useResponseTabs must be inside <ResponseTabsProvider>");
  return ctx;
}
