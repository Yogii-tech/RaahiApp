import { API_BASE } from '../apiConfig';

/**
 * TrackingService handles the high-performance delivery tracking logic.
 * It uses a 5-second polling strategy to save battery and server costs,
 * while the frontend uses interpolation to keep movement smooth.
 */
class TrackingService {
    private pollInterval: any = null;
    private riderId: string = '';
    private orderId: string = '';

    /**
     * Start tracking the rider's position
     */
    public startTracking(riderId: string, orderId: string) {
        this.riderId = riderId;
        this.orderId = orderId;

        if (this.pollInterval) clearInterval(this.pollInterval);

        // 5-Second Selective Polling (Server Cost Saver)
        this.pollInterval = setInterval(() => {
            this.captureAndUpload();
        }, 5000);

        console.log(`🚀 Tracking started for Rider: ${riderId}, Order: ${orderId}`);
        // Immediate first capture
        this.captureAndUpload();
    }

    /**
     * Stop the tracking interval
     */
    public stopTracking() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
        console.log('🛑 Tracking stopped');
    }

    /**
     * Captures current location and sends to Go backend via REST
     */
    private async captureAndUpload() {
        // In a real app, use react-native-background-geolocation or similar.
        // For this implementation, we'll use a mocked "Hill road" simulation 
        // to demonstrate the interpolation on the customer's map.
        
        const mockCoords = this.getMockHillRouteCoords();

        try {
            const response = await fetch(`${API_BASE}/api/tracking/location`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    rider_id: this.riderId,
                    order_id: this.orderId,
                    latitude: mockCoords.lat,
                    longitude: mockCoords.lng
                })
            });

            if (!response.ok) {
                console.warn('Tracking upload failed. Dead reckoning fallback would activate here.');
            }
        } catch (err) {
            console.error('Tracking capture error:', err);
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
