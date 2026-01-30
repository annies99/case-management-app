import React, { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

const SignaturePad = forwardRef(function SignaturePad(
  {
    strokeColor = '#000',
    strokeWidth = 2,
    backgroundColor = '#fff',
    style,
    onBegin,
    onEnd,
  },
  ref
) {
  const pathsRef = useRef([]);
  const sizeRef = useRef({ width: 0, height: 0 });
  const [paths, setPaths] = useState([]);

  const updatePaths = () => {
    setPaths([...pathsRef.current]);
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
          const { locationX, locationY } = event.nativeEvent;
          pathsRef.current.push(`M ${locationX.toFixed(2)} ${locationY.toFixed(2)}`);
          updatePaths();
          onBegin?.();
        },
        onPanResponderMove: (event) => {
          const { locationX, locationY } = event.nativeEvent;
          if (!pathsRef.current.length) return;
          const idx = pathsRef.current.length - 1;
          pathsRef.current[idx] += ` L ${locationX.toFixed(2)} ${locationY.toFixed(2)}`;
          updatePaths();
        },
        onPanResponderRelease: () => {
          onEnd?.();
        },
        onPanResponderTerminate: () => {
          onEnd?.();
        },
      }),
    [onBegin, onEnd]
  );

  useImperativeHandle(ref, () => ({
    clear: () => {
      pathsRef.current = [];
      updatePaths();
    },
    isEmpty: () => pathsRef.current.length === 0,
    toDataURL: () =>
      new Promise((resolve, reject) => {
        const { width, height } = sizeRef.current;
        if (!width || !height) {
          reject(new Error('Signature area is not ready yet.'));
          return;
        }
        if (!pathsRef.current.length) {
          reject(new Error('No signature captured.'));
          return;
        }
        try {
          const serializedPaths = pathsRef.current
            .map(
              (d) =>
                `<path d="${d}" stroke="${strokeColor}" stroke-width="${strokeWidth}" fill="none" stroke-linejoin="round" stroke-linecap="round"/>`
            )
            .join('');
          const svgMarkup = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${serializedPaths}</svg>`;
          resolve(`data:image/svg+xml;utf8,${encodeURIComponent(svgMarkup)}`);
        } catch (error) {
          reject(error instanceof Error ? error : new Error('Failed to serialize signature.'));
        }
      }),
  }));

  return (
    <View
      style={[styles.container, { backgroundColor }, style]}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        sizeRef.current = { width, height };
      }}
      {...panResponder.panHandlers}
    >
      <Svg style={StyleSheet.absoluteFill}>
        {paths.map((d, index) => (
          <Path
            key={`path-${index}`}
            d={d}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
      </Svg>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: 6,
    overflow: 'hidden',
  },
});

export default SignaturePad;
