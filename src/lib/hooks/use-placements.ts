"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getCoreClient } from "@/lib/api/endpoints";

export interface PlacementRow {
	id: string;
	work_tile_id: string;
	time_tile_id: string;
	planned_minutes: number;
}

export interface CandidateRow {
	work_tile_id: string;
}

interface PlacementsState {
	placements: PlacementRow[];
	loading: boolean;
	error: Error | null;
}

interface CandidatesState {
	candidates: CandidateRow[];
	loading: boolean;
	error: Error | null;
}

export function usePlacements() {
	const [state, setState] = useState<PlacementsState>({
		placements: [],
		loading: true,
		error: null,
	});
	const mountedRef = useRef(true);

	const fetchOnce = useCallback(async () => {
		const res = await getCoreClient().call<{ placements: PlacementRow[] }>("getPlacements");
		if (!mountedRef.current) return;
		if (res.ok) {
			setState({ placements: res.data?.placements ?? [], loading: false, error: null });
		} else {
			setState({
				placements: [],
				loading: false,
				error: new Error(res.error.message),
			});
		}
	}, []);

	useEffect(() => {
		mountedRef.current = true;
		setState((prev) => ({ ...prev, loading: true, error: null }));
		void fetchOnce();
		return () => {
			mountedRef.current = false;
		};
	}, [fetchOnce]);

	const refresh = useCallback(async () => {
		setState((prev) => ({ ...prev, loading: true, error: null }));
		await fetchOnce();
	}, [fetchOnce]);

	return { ...state, refresh };
}

export function useCandidates() {
	const [state, setState] = useState<CandidatesState>({
		candidates: [],
		loading: true,
		error: null,
	});
	const mountedRef = useRef(true);

	const fetchOnce = useCallback(async () => {
		const res = await getCoreClient().call<{ candidates: CandidateRow[] }>("getCandidates");
		if (!mountedRef.current) return;
		if (res.ok) {
			setState({ candidates: res.data?.candidates ?? [], loading: false, error: null });
		} else {
			setState({
				candidates: [],
				loading: false,
				error: new Error(res.error.message),
			});
		}
	}, []);

	useEffect(() => {
		mountedRef.current = true;
		setState((prev) => ({ ...prev, loading: true, error: null }));
		void fetchOnce();
		return () => {
			mountedRef.current = false;
		};
	}, [fetchOnce]);

	return { ...state, refresh: fetchOnce };
}