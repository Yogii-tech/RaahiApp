import React, { useState } from 'react';
import { View, Text, StyleSheet, useWindowDimensions, Platform, ScrollView, TouchableOpacity } from 'react-native';

interface AdminChartProps {
     data: number[];
     labels: string[];
     accentColor: string;
     isDark: boolean;
     height?: number;
}

export default function AdminChart({ data, labels, accentColor, isDark, height: chartHeight = 180 }: AdminChartProps) {
     const [activeWidth, setActiveWidth] = useState(0);
     const [hoverIndex, setHoverIndex] = useState<number | null>(null);
     const [zoom, setZoom] = useState(1);
     const { width: windowWidth } = useWindowDimensions();
     const isMobile = windowWidth < 768;

     const maxVal = Math.max(...data, 1);
     const T = {
          grid: isDark ? 'rgba(255,255,255,0.05)' : '#eee',
          text: isDark ? '#9CA3AF' : '#6C757D',
          tooltipBg: isDark ? '#1F2937' : '#FFFFFF',
          tooltipText: isDark ? '#F9FAFB' : '#1F2937',
          referenceLine: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)',
     };

     const totalChartWidth = activeWidth * zoom;

     return (
          <View style={[styles.container, { height: chartHeight + 60 }]}>
               <View style={styles.chartYAxis}>
                    {[maxVal, Math.floor(maxVal / 2), 0].map(v => (
                         <Text key={v} style={[styles.yLabel, { color: T.text }]}>{v}</Text>
                    ))}
                    <View style={styles.zoomControls}>
                         <TouchableOpacity onPress={() => setZoom(Math.min(zoom + 0.5, 4))} style={[styles.zoomBtn, { backgroundColor: T.grid }]}>
                              <Text style={{ color: T.text, fontWeight: 'bold', fontSize: 14 }}>+</Text>
                         </TouchableOpacity>
                         <TouchableOpacity onPress={() => setZoom(Math.max(zoom - 0.5, 1))} style={[styles.zoomBtn, { backgroundColor: T.grid, marginTop: 4 }]}>
                              <Text style={{ color: T.text, fontWeight: 'bold', fontSize: 14 }}>-</Text>
                         </TouchableOpacity>
                    </View>
               </View>

               <View
                    style={[styles.chartMain, { height: chartHeight }]}
                    onLayout={(e) => setActiveWidth(e.nativeEvent.layout.width)}
               >
                    <ScrollView
                         horizontal
                         showsHorizontalScrollIndicator={zoom > 1}
                         contentContainerStyle={{ width: totalChartWidth, height: chartHeight + 40 }}
                    >
                         {/* Grid Rows - Fixed to container background optionally, but here we let them scroll */}
                         <View style={[styles.gridOverlay, { width: totalChartWidth }]}>
                              {[...Array(5)].map((_, i) => (
                                   <View key={i} style={[styles.gridRow, { borderBottomColor: T.grid }]} />
                              ))}
                         </View>

                         <View style={[styles.chartLinesContainer, { width: totalChartWidth }]}>
                              {data.map((v, i) => {
                                   const h = (v / maxVal) * chartHeight;
                                   const nextV = i < data.length - 1 ? data[i + 1] : v;
                                   const nextH = (nextV / maxVal) * chartHeight;

                                   const stepWidth = (totalChartWidth - 40) / (data.length - 1 || 1);

                                   return (
                                        <View
                                             key={i}
                                             style={[styles.chartCol, { width: i === data.length - 1 ? 0 : stepWidth }]}
                                             // @ts-ignore - Web events
                                             onMouseEnter={() => setHoverIndex(i)}
                                             onMouseLeave={() => setHoverIndex(null)}
                                        >
                                             {/* Vertical Grid Line */}
                                             <View style={[styles.gridCol, { borderRightColor: T.grid, left: 0 }]} />

                                             {/* Reference Lines on Hover */}
                                             {hoverIndex === i && (
                                                  <View style={[StyleSheet.absoluteFill, { zIndex: 10, pointerEvents: 'none' }]}>
                                                       <View style={[styles.referenceLineH, { bottom: h, left: -totalChartWidth, right: 0, borderColor: T.referenceLine }]} />
                                                       <View style={[styles.referenceLineV, { left: 0, height: h, borderColor: T.referenceLine }]} />
                                                  </View>
                                             )}

                                             {/* Line Segment */}
                                             {i < data.length - 1 && (
                                                  <View
                                                       style={[
                                                            styles.connectorLine,
                                                            {
                                                                 bottom: h,
                                                                 backgroundColor: accentColor,
                                                                 width: stepWidth + 2,
                                                                 transform: [
                                                                      { rotate: `${Math.atan2(nextH - h, stepWidth) * (180 / Math.PI) * -1}deg` }
                                                                 ],
                                                                 left: 0,
                                                            }
                                                       ]}
                                                  />
                                             )}

                                             {/* Data Point */}
                                             <View
                                                  style={[
                                                       styles.chartPoint,
                                                       {
                                                            bottom: h - 5,
                                                            left: -5,
                                                            backgroundColor: hoverIndex === i ? '#fff' : accentColor,
                                                            borderColor: accentColor
                                                       }
                                                  ]}
                                             />

                                             {/* Tooltip */}
                                             {hoverIndex === i && (
                                                  <View style={[styles.tooltip, { bottom: h + 15, backgroundColor: T.tooltipBg, borderColor: accentColor }]}>
                                                       <Text style={[styles.tooltipText, { color: T.tooltipText }]}>{v}</Text>
                                                  </View>
                                             )}
                                        </View>
                                   );
                              })}
                              {/* Last Grid Line */}
                              <View style={[styles.gridCol, { borderRightColor: T.grid, right: 0 }]} />
                         </View>

                         {/* X Labels */}
                         <View style={[styles.chartLabelsRow, { width: totalChartWidth }]}>
                              {labels.map((l, idx) => (
                                   <Text key={`${l}-${idx}`} style={[styles.xLabel, { color: T.text }]}>{l}</Text>
                              ))}
                         </View>
                    </ScrollView>
               </View>
          </View>
     );
}

const styles = StyleSheet.create({
     container: { flexDirection: 'row', alignItems: 'flex-start', width: '100%', paddingTop: 10 },
     chartYAxis: { width: 40, height: '100%', justifyContent: 'space-between', paddingBottom: 60, paddingTop: 0 },
     yLabel: { fontSize: 10, textAlign: 'right', paddingRight: 8 },
     chartMain: { flex: 1, position: 'relative' },
     gridOverlay: { position: 'absolute', top: 0, left: 0, bottom: 40, zIndex: 0 },
     gridRow: { flex: 1, borderBottomWidth: 1 },
     gridCol: { position: 'absolute', top: 0, bottom: 0, borderRightWidth: 1, zIndex: 0 },
     chartLinesContainer: { flexDirection: 'row', zIndex: 1, height: '100%', paddingRight: 20 },
     chartCol: { height: '100%', justifyContent: 'flex-end', zIndex: 5, position: 'relative' },
     connectorLine: { position: 'absolute', height: 2.5, zIndex: 5, transformOrigin: 'left bottom' },
     chartPoint: { width: 10, height: 10, borderRadius: 5, position: 'absolute', zIndex: 10, borderWidth: 2 },
     tooltip: { position: 'absolute', left: -20, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, borderWidth: 1, zIndex: 100, minWidth: 40, alignItems: 'center' },
     tooltipText: { fontSize: 10, fontWeight: 'bold' },
     chartLabelsRow: { position: 'absolute', bottom: 10, left: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 0 },
     xLabel: { fontSize: 10, width: 30, textAlign: 'center' },
     referenceLineH: { position: 'absolute', borderBottomWidth: 1, borderStyle: 'dashed', zIndex: 2 },
     referenceLineV: { position: 'absolute', borderLeftWidth: 1, borderStyle: 'dashed', bottom: 0, zIndex: 2 },
     zoomControls: { marginTop: 10, alignItems: 'center' },
     zoomBtn: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
});
