import {
  AtSign,
  BookOpen,
  Briefcase,
  Camera,
  ExternalLink,
  FolderGit2,
  Globe,
  GraduationCap,
  MapPin,
  MessageCircle,
  Newspaper,
  Rss,
  Share2,
  Video,
} from "lucide-react";
import { Card, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import { platformLabel } from "@/lib/utils";
import type { StructuredProfile } from "@/types/person";
import type { PublicProfile } from "@/types/publication";

const PLATFORM_ICON: Record<string, typeof Globe> = {
  github: FolderGit2,
  orcid: BookOpen,
  google_scholar: GraduationCap,
  linkedin: Briefcase,
  instagram: Camera,
  facebook: Share2,
  x: AtSign,
  threads: AtSign,
  bluesky: AtSign,
  youtube: Video,
  tiktok: Video,
  medium: Newspaper,
  substack: Rss,
  wikipedia: BookOpen,
  university: GraduationCap,
  mastodon: MessageCircle,
  website: Globe,
};

interface Props {
  name: string;
  profile: StructuredProfile | null;
  profiles: PublicProfile[];
  publicationCount: number;
}

export function ProfileOverview({ name, profile, profiles, publicationCount }: Props) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            {name}
          </h2>
          <p className="text-sm text-muted">Professional &amp; Academic Profile</p>
          {profile?.headline && (
            <p className="mt-2 text-[15px] text-foreground/80">{profile.headline}</p>
          )}
          {profile?.location && (
            <p className="mt-1.5 inline-flex items-center gap-1 text-sm text-muted">
              <MapPin className="h-3.5 w-3.5" />
              {profile.location}
            </p>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {profiles.map((p) => {
            const Icon = PLATFORM_ICON[p.platform] ?? Globe;
            return (
              <a
                key={p.id}
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-foreground/25 hover:bg-black/[0.02]"
              >
                <Icon className="h-3.5 w-3.5 text-muted" />
                {platformLabel(p.platform)}
                {p.username && (
                  <span className="text-muted/70">@{p.username}</span>
                )}
                <ExternalLink className="h-3 w-3 text-muted/60" />
              </a>
            );
          })}
          {publicationCount > 0 && (
            <Badge tone="accent" className="px-2.5 py-1.5">
              <BookOpen className="h-3.5 w-3.5" />
              {publicationCount} publication{publicationCount === 1 ? "" : "s"}
            </Badge>
          )}
        </div>

        <div className="mt-5 border-t border-border pt-5">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted">
            Overview
          </h3>
          <p className="mt-2 max-w-3xl text-[15px] leading-7 text-foreground/90">
            {profile?.summary ??
              "Not verified from the available public sources."}
          </p>
        </div>

        {(profile?.researchAreas?.length ?? 0) > 0 && (
          <div className="mt-5">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted">
              Research areas
            </h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {profile!.researchAreas.map((r) => (
                <Badge key={r}>{r}</Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
