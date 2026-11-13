import { API_BASE } from '../apiConfig';

export type TrackingState = 'idle' | 'running';

/**
 * TrackingService handles the high-performance delivery tracking logic.
 * It uses a 5-second polling strategy to save battery and server costs,
 * while the frontend uses interpolation to keep movement smooth.
 */
class TrackingService {
    private state: TrackingState = 'idle';
    private inFlight: boolean = false;
    private abortController: AbortController | null = null;
    private pollInterval: ReturnType<typeof setInterval> | null = null;
    private riderId: string = '';
    private orderId: string = '';

    public getState(): TrackingState {
        return this.state;
    }

    /**
     * Start tracking the rider's position
     */
    public startTracking(riderId: string, orderId: string) {
        if (this.state === 'running') {
            this.stopTracking();
        }

        this.riderId = riderId;
        this.orderId = orderId;
        this.step = 0;
        this.state = 'running';

        // 5-Second Selective Polling (Server Cost Saver)
        this.pollInterval = setInterval(() => {
            void this.captureAndUpload();
        }, 5000);

        console.log(`🚀 Tracking started for Rider: ${riderId}, Order: ${orderId}`);
        // Immediate first capture
        void this.captureAndUpload();
    }

    /**
     * Stop the tracking interval and abort any in-flight upload
     */
    public stopTracking() {
        this.state = 'idle';
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
        this.inFlight = false;
        this.riderId = '';
        this.orderId = '';
        this.step = 0;
        console.log('🛑 Tracking stopped');
    }

    /**
     * Captures current location and sends to Go backend via REST
     */
    private async captureAndUpload() {
        if (this.state !== 'running' || this.inFlight) {
            return;
        }

        this.inFlight = true;
        const controller = new AbortController();
        this.abortController = controller;
        const riderId = this.riderId;
        const orderId = this.orderId;

        // In a real app, use react-native-background-geolocation or similar.
        // For this implementation, we'll use a mocked "Hill road" simulation 
        // to demonstrate the interpolation on the customer's map.
        const mockCoords = this.getMockHillRouteCoords();

        try {
            const response = await fetch(`${API_BASE}/api/tracking/location`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify({
                    rider_id: riderId,
                    order_id: orderId,
                    latitude: mockCoords.lat,
                    longitude: mockCoords.lng
                })
            });

            if (!response.ok) {
                console.warn('Tracking upload failed. Dead reckoning fallback would activate here.');
            }
        } catch (err: any) {
            if (err?.name !== 'AbortError') {
                console.error('Tracking capture error:', err);
            }
        } finally {
            if (this.abortController === controller) {
                this.abortController = null;
            }
            this.inFlight = false;
        }
    }

    // Mock logic for demo/testing purposes
    private step = 0;
    private getMockHillRouteCoords() {
        // Simulating a path through Dehradun/Mussoorie area
        const startLat = 30.3165;
        const startLng = 78.0322;
        this.step += 1;
        
        // Circular path simulation
        return {
            lat: startLat + (Math.sin(this.step * 0.1) * 0.05),
            lng: startLng + (Math.cos(this.step * 0.1) * 0.05)
        };
    }
}

export default new TrackingService();
