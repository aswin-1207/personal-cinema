// CinemaModeView.swift - Immersive Full-Screen Watch Experience
import SwiftUI

struct CinemaModeView: View {
    @State private var viewModel: CinemaModeViewModel
    @State private var controlsVisible = true
    @State private var controlsTimer: Task<Void, Never>?
    @State private var showingCompletion = false
    @State private var appeared = false
    @Environment(\.dismiss) private var dismiss

    init(movie: MovieBrief, scheduledDate: Date? = nil) {
        _viewModel = State(initialValue: CinemaModeViewModel(movie: movie, scheduledDate: scheduledDate))
    }

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            switch viewModel.timerState {
            case .idle:
                previewPhase
            case .running, .paused:
                watchPhase
            case .completed:
                completedPhase
            }
        }
        .preferredColorScheme(.dark)
        .statusBarHidden(viewModel.timerState == .running)
        .onAppear {
            withAnimation(CinemaAnimation.slow) { appeared = true }
        }
        .fullScreenCover(isPresented: $showingCompletion) {
            WatchCompletionView(
                movie: viewModel.movie,
                duration: viewModel.elapsedSeconds / 60,
                onComplete: { rating, notes in
                    Task { await viewModel.completeSession(rating: rating, notes: notes) }
                    showingCompletion = false
                    dismiss()
                }
            )
        }
    }

    // MARK: - Phase 1: Screening Preview
    private var previewPhase: some View {
        VStack(spacing: CinemaSpacing.xl) {
            Spacer()

            AsyncImage(url: viewModel.movie.posterURL) { phase in
                switch phase {
                case .success(let image):
                    image.resizable().aspectRatio(contentMode: .fit)
                default:
                    ZStack {
                        Color.cinemaCharcoal
                        Image(systemName: "film").font(.system(size: 60)).foregroundColor(.cinemaGold.opacity(0.4))
                    }
                }
            }
            .frame(width: 200, height: 300)
            .clipShape(RoundedRectangle(cornerRadius: CinemaRadius.lg))
            .shadow(color: Color.cinemaGold.opacity(0.25), radius: 30, x: 0, y: 10)
            .opacity(appeared ? 1 : 0)
            .scaleEffect(appeared ? 1 : 0.85)
            .animation(CinemaAnimation.slow, value: appeared)

            VStack(spacing: CinemaSpacing.sm) {
                Text(viewModel.movie.title)
                    .font(.cinemaDisplay)
                    .foregroundColor(.cinemaWhite)
                    .multilineTextAlignment(.center)
                    .opacity(appeared ? 1 : 0)
                    .animation(CinemaAnimation.slow.delay(0.2), value: appeared)

                if let year = viewModel.movie.releaseYear {
                    Text(year)
                        .font(.cinemaCaption)
                        .foregroundColor(.cinemaSubtle)
                        .opacity(appeared ? 1 : 0)
                        .animation(CinemaAnimation.slow.delay(0.3), value: appeared)
                }

                if let date = viewModel.scheduledDate {
                    Text("Screening · \(date.formatted(date: .omitted, time: .shortened))")
                        .font(.cinemaBodyMedium)
                        .foregroundColor(.cinemaGold)
                        .opacity(appeared ? 1 : 0)
                        .animation(CinemaAnimation.slow.delay(0.4), value: appeared)
                }
            }
            .padding(.horizontal, CinemaSpacing.xl)

            Spacer()

            VStack(spacing: CinemaSpacing.md) {
                Button {
                    Task { await viewModel.startSession() }
                } label: {
                    HStack(spacing: 8) {
                        Image(systemName: "play.circle.fill")
                            .font(.system(size: 20))
                        Text("BEGIN CINEMA EXPERIENCE")
                            .kerning(2)
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: 60)
                }
                .buttonStyle(CinemaButtonStyle(variant: .primary))
                .padding(.horizontal, CinemaSpacing.xl)
                .opacity(appeared ? 1 : 0)
                .animation(CinemaAnimation.slow.delay(0.5), value: appeared)

                Button { dismiss() } label: {
                    Text("Exit")
                        .font(.cinemaCaption)
                        .foregroundColor(.cinemaSubtle)
                }
                .opacity(appeared ? 1 : 0)
                .animation(CinemaAnimation.slow.delay(0.6), value: appeared)
            }
            .padding(.bottom, CinemaSpacing.xxxl)
        }
        .frame(maxWidth: .infinity)
        .background(
            LinearGradient(
                colors: [Color.black, Color.cinemaDeepNavy.opacity(0.8)],
                startPoint: .top, endPoint: .bottom
            )
            .ignoresSafeArea()
        )
    }

    // MARK: - Phase 2: Active Watch Session (True Black Cinema Mode)
    private var watchPhase: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            VStack(spacing: CinemaSpacing.xl) {
                Spacer()

                // Movie Poster with Subtle Ambient Halo
                ZStack {
                    AsyncImage(url: viewModel.movie.posterURL) { phase in
                        switch phase {
                        case .success(let image):
                            image.resizable().aspectRatio(contentMode: .fit)
                        default:
                            Color.cinemaCharcoal
                        }
                    }
                    .frame(width: 150, height: 225)
                    .clipShape(RoundedRectangle(cornerRadius: CinemaRadius.md))
                    .shadow(color: Color.cinemaGold.opacity(0.18), radius: 40, x: 0, y: 0)
                }

                VStack(spacing: CinemaSpacing.sm) {
                    Text(viewModel.movie.title)
                        .font(.cinemaH3)
                        .foregroundColor(.cinemaWhite.opacity(0.7))
                        .multilineTextAlignment(.center)

                    // Main Monospace Timer: Remaining
                    Text(viewModel.formattedRemaining)
                        .font(.cinemaTimer)
                        .foregroundColor(.cinemaWhite)
                        .monospacedDigit()

                    Text("ESTIMATED REMAINING")
                        .font(.cinemaLabel)
                        .foregroundColor(.cinemaSubtle)
                        .kerning(3)

                    // Elapsed Time
                    Text(viewModel.formattedElapsed)
                        .font(.cinemaTimerSmall)
                        .foregroundColor(.cinemaSubtle.opacity(0.7))
                        .monospacedDigit()
                        .padding(.top, 4)

                    Text("ELAPSED")
                        .font(.cinemaLabel)
                        .foregroundColor(.cinemaSubtle.opacity(0.5))
                        .kerning(2)

                    if viewModel.timerState == .paused {
                        Text("PAUSED")
                            .font(.cinemaLabel)
                            .foregroundColor(.cinemaGold)
                            .kerning(3)
                            .padding(.top, CinemaSpacing.sm)
                    }
                }

                Spacer()

                // Controls (revealed on tap)
                if controlsVisible {
                    controlsView
                        .transition(.opacity)
                }
            }
            .contentShape(Rectangle())
            .onTapGesture {
                toggleControls()
            }
        }
        .animation(CinemaAnimation.fast, value: controlsVisible)
    }

    private var controlsView: some View {
        HStack(spacing: CinemaSpacing.xxl) {
            Button {
                if viewModel.timerState == .running {
                    viewModel.pauseSession()
                } else {
                    viewModel.resumeSession()
                }
            } label: {
                VStack(spacing: CinemaSpacing.xs) {
                    Image(systemName: viewModel.timerState == .paused ? "play.circle" : "pause.circle")
                        .font(.system(size: 46, weight: .thin))
                        .foregroundColor(.cinemaWhite)
                    Text(viewModel.timerState == .paused ? "RESUME" : "PAUSE")
                        .font(.cinemaLabel)
                        .foregroundColor(.cinemaSubtle)
                        .kerning(1.5)
                }
            }

            Button {
                showingCompletion = true
            } label: {
                VStack(spacing: CinemaSpacing.xs) {
                    Image(systemName: "stop.circle")
                        .font(.system(size: 46, weight: .thin))
                        .foregroundColor(.cinemaCrimsonSoft)
                    Text("FINISH")
                        .font(.cinemaLabel)
                        .foregroundColor(.cinemaCrimsonSoft.opacity(0.8))
                        .kerning(1.5)
                }
            }
        }
        .padding(.bottom, CinemaSpacing.xxxl)
    }

    // MARK: - Phase 3: Completed Session
    private var completedPhase: some View {
        VStack(spacing: CinemaSpacing.xl) {
            Spacer()
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 80, weight: .thin))
                .foregroundColor(.cinemaGold)

            VStack(spacing: CinemaSpacing.sm) {
                Text("MOVIE COMPLETE")
                    .font(.cinemaDisplay)
                    .foregroundColor(.cinemaWhite)
                Text(viewModel.movie.title)
                    .font(.cinemaBody)
                    .foregroundColor(.cinemaSubtle)
            }

            Spacer()

            Button {
                showingCompletion = true
            } label: {
                Text("COLLECT MOVIE RECEIPT")
                    .kerning(1.5)
                    .frame(maxWidth: .infinity)
                    .frame(height: 52)
            }
            .buttonStyle(CinemaButtonStyle(variant: .primary))
            .padding(.horizontal, CinemaSpacing.xl)
            .padding(.bottom, CinemaSpacing.xxxl)
        }
    }

    private func toggleControls() {
        controlsTimer?.cancel()
        withAnimation(CinemaAnimation.fast) {
            controlsVisible = true
        }
        controlsTimer = Task {
            try? await Task.sleep(nanoseconds: 3_000_000_000)
            if !Task.isCancelled {
                withAnimation(CinemaAnimation.fast) {
                    controlsVisible = false
                }
            }
        }
    }
}
