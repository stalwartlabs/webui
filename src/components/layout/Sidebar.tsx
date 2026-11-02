/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronRight, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { DynamicIcon } from '@/components/common/DynamicIcon';
import { EnterpriseUpsell } from '@/components/common/EnterpriseUpsell';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useUIStore } from '@/stores/uiStore';
import type { Layout } from '@/types/schema';
import { activeViewName, layoutNavNodes, navNodeKey, someLink, viewPath, type NavNode } from './navTree';
import { SIDEBAR_ID, SidebarNavContext, useSidebarNav } from './sidebarContext';
import { useLayoutNavigation } from './useLayoutNavigation';

const itemClass =
  'flex w-full items-center gap-2.5 rounded-[10px] px-2.5 text-left font-medium text-muted-foreground outline-none transition-colors duration-200 hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring';

function itemSize(depth: number) {
  return depth > 0 ? 'h-8 text-[13px]' : 'h-9 text-sm';
}

function NavLink({ node, depth }: { node: Extract<NavNode, { kind: 'link' }>; depth: number }) {
  const { t } = useTranslation();
  const nav = useSidebarNav();
  const ref = useRef<HTMLAnchorElement>(null);
  const isActive = node.viewName === nav.activeViewName;

  useEffect(() => {
    if (isActive) ref.current?.scrollIntoView?.({ block: 'nearest' });
  }, [isActive]);

  if (!nav.isVisible(node.viewName)) return null;

  const label = node.name || t('sidebar.overview', 'Overview');
  const content = (
    <>
      {node.icon && <DynamicIcon name={node.icon} className="h-4 w-4 shrink-0" />}
      <span className="truncate">{label}</span>
    </>
  );
  const className = cn(itemClass, itemSize(depth));

  if (nav.isLocked(node.viewName)) {
    return (
      <button type="button" className={className} onClick={nav.openUpsell} aria-describedby={nav.lockedHintId}>
        {content}
        <Lock aria-hidden="true" className="ml-auto h-3 w-3 text-muted-foreground" />
      </button>
    );
  }

  return (
    <Link
      ref={ref}
      to={viewPath(nav.sectionName, node.viewName)}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        className,
        isActive &&
          'bg-highlight font-semibold text-highlight-foreground hover:bg-highlight hover:text-highlight-foreground',
      )}
    >
      {content}
    </Link>
  );
}

function NavContainer({ node, depth }: { node: Extract<NavNode, { kind: 'container' }>; depth: number }) {
  const nav = useSidebarNav();
  const containsActive = someLink(node.children, (viewName) => viewName === nav.activeViewName);
  const [open, setOpen] = useState(containsActive);
  const [prevContainsActive, setPrevContainsActive] = useState(containsActive);
  if (containsActive !== prevContainsActive) {
    setPrevContainsActive(containsActive);
    if (containsActive) setOpen(true);
  }

  if (!someLink(node.children, nav.isVisible)) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button type="button" className={cn(itemClass, itemSize(depth))}>
          {node.icon && <DynamicIcon name={node.icon} className="h-4 w-4 shrink-0" />}
          <span className="truncate">{node.name}</span>
          <ChevronRight
            aria-hidden="true"
            className="ml-auto h-3.5 w-3.5 shrink-0 opacity-60 transition-transform duration-200 [[data-state=open]>&]:rotate-90"
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="my-0.5 ml-[18px] flex flex-col gap-0.5 border-l border-input pl-2">
          <NavNodes nodes={node.children} depth={depth + 1} />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function NavNodes({ nodes, depth }: { nodes: NavNode[]; depth: number }) {
  return nodes.map((node) =>
    node.kind === 'link' ? (
      <NavLink key={navNodeKey(node)} node={node} depth={depth} />
    ) : (
      <NavContainer key={navNodeKey(node)} node={node} depth={depth} />
    ),
  );
}

function SectionSwitcher({ layouts, activeSection }: { layouts: Layout[]; activeSection: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setActiveSection = useUIStore((s) => s.setActiveSection);
  const { landingPath } = useLayoutNavigation();

  return (
    <div
      role="group"
      aria-label={t('sections', 'Sections')}
      className="m-2.5 mt-0 flex items-center gap-0.5 rounded-full bg-muted p-1"
    >
      {layouts.map((target) => {
        const isActive = target.name === activeSection;
        return (
          <Tooltip key={target.name}>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={target.name}
                aria-pressed={isActive}
                onClick={() => {
                  setActiveSection(target.name);
                  const path = landingPath(target);
                  if (path) navigate(path);
                }}
                className={cn(
                  'h-8 flex-1 rounded-full',
                  isActive && 'bg-card text-foreground shadow-tile hover:bg-card hover:text-foreground',
                )}
              >
                <DynamicIcon name={target.icon} className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">{target.name}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

export function Sidebar() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const activeSection = useUIStore((s) => s.activeSection);
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);
  const { layouts, isVisible, isLocked } = useLayoutNavigation();
  const [upsellOpen, setUpsellOpen] = useState(false);
  const lockedHintId = useId();

  useEffect(() => {
    if (window.matchMedia('(max-width: 767px)').matches) setSidebarOpen(false);
  }, [pathname, setSidebarOpen]);

  if (!sidebarOpen) return null;
  const layout = layouts.find((l) => l.name === activeSection);
  if (!layout) return null;

  const nodes = layoutNavNodes(layout);
  const nav = {
    sectionName: layout.name,
    pathname,
    activeViewName: activeViewName(nodes, pathname, layout.name),
    isVisible,
    isLocked,
    openUpsell: () => setUpsellOpen(true),
    lockedHintId,
  };

  return (
    <>
      <div
        aria-hidden="true"
        className="fixed inset-0 top-16 z-20 bg-overlay md:hidden"
        onClick={() => setSidebarOpen(false)}
      />
      <aside
        id={SIDEBAR_ID}
        aria-label={t('sidebar.label', 'Sidebar')}
        className="fixed bottom-3 left-3 top-16 z-30 flex w-60 flex-col tile overflow-hidden"
      >
        <span id={lockedHintId} className="sr-only">
          {t('enterprise.featureHint', 'Enterprise feature')}
        </span>
        <div className="flex-1 overflow-y-auto py-2.5 [scrollbar-width:thin]">
          <nav aria-label={layout.name} className="flex flex-col gap-0.5 px-2.5">
            <SidebarNavContext value={nav}>
              <NavNodes nodes={nodes} depth={0} />
            </SidebarNavContext>
          </nav>
        </div>

        {layouts.length > 1 && <SectionSwitcher layouts={layouts} activeSection={activeSection} />}

        <EnterpriseUpsell open={upsellOpen} onClose={() => setUpsellOpen(false)} />
      </aside>
    </>
  );
}
